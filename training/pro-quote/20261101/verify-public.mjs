import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const origin = process.argv.find(arg => arg.startsWith('--origin='))?.slice(9);
if (!['http://localhost:3112','https://www.felexia.pro'].includes(origin)) throw Error('Explicit review or production origin required');
const checks = [];
function check(name, passed) { checks.push({ name, passed: Boolean(passed) }); assert(passed, name); }
const htmls = {};
for (const path of ['/','/pricing','/conditions','/mentions-legales','/confidentialite','/api/health','/robots.txt','/sitemap.xml']) {
  const response = await fetch(origin + path, { redirect:'manual', signal:AbortSignal.timeout(30000) });
  check(path + ' is available', response.status === 200); htmls[path] = await response.text();
}
for (const path of ['/','/pricing']) {
  const html = htmls[path];
  const card = html.match(/<article[^>]*class="conversion-price-card conversion-price-card-pro"[\s\S]*?<\/article>/)?.[0] ?? '';
  const text = card.replace(/<[^>]+>/g,' ');
  check(path + ' retains two offers', (html.match(/<article[^>]*class="conversion-price-card(?: conversion-price-card-pro)?"/g) ?? []).length === 2);
  check(path + ' has PRO exclusively on quotation', text.includes('Sur devis') && text.includes('Demander un devis'));
  check(path + ' has no PRO amount or billing period', !/\b(?:MAD|1290|12900|1[\s\u202f]290|12[\s\u202f]900)\b/.test(text) && !/\/\s*(?:mois|an)\b/.test(text));
  check(path + ' quote action only opens a draft email', /href="mailto:contact@felexia\.pro\?subject=Felexia%20PRO/.test(card));
  check(path + ' no longer offers a PRO checkout link', !/href="\/parametres\/abonnement\?plan=pro/.test(html));
  check(path + ' keeps Essentiel monthly price', html.includes('290') && html.includes('Période de facturation ESSENTIEL'));
}
const response = await fetch(origin + '/images/felexia-horizon-v1.png', { signal:AbortSignal.timeout(30000) });
const actual = Buffer.from(await response.arrayBuffer());
const expected = await readFile(new URL('../../../public/images/felexia-horizon-v1.png', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
check('Landscape remains unchanged', response.status === 200 && hash(actual) === hash(expected));
const denied = await fetch(origin + '/api/stripe/checkout', { method:'POST', redirect:'manual', headers:{ 'content-type':'application/json',origin }, body:JSON.stringify({planCode:'pro',billingInterval:'monthly'}), signal:AbortSignal.timeout(30000) });
check('Anonymous billing request remains forbidden', denied.status === 401);
const report = { date:new Date().toISOString(),origin,passed:true,checks,imageSha256:hash(actual),scope:'Public GETs and an anonymous rejected billing request; no authenticated mutation or email' };
await writeFile(new URL(origin.startsWith('http:') ? './local-public.json' : './production-public.json', import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:checks.length,origin}));
