import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const origin = process.argv.find(v => v.startsWith('--origin='))?.slice(9);
if (!['http://localhost:3112', 'https://www.felexia.pro'].includes(origin)) throw Error('Explicit approved local or public origin required');
const checks = [];
const check = (name, passed) => { checks.push({ name, passed: Boolean(passed) }); assert(passed, name); };
const htmls = {};
for (const pathname of ['/', '/pricing', '/mentions-legales', '/confidentialite', '/conditions', '/api/health', '/robots.txt', '/sitemap.xml']) {
  const response = await fetch(origin + pathname, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  check(pathname + ' responds 200', response.status === 200);
  htmls[pathname] = await response.text();
}
for (const pathname of ['/', '/pricing']) {
  const html = htmls[pathname];
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
  check(pathname + ' offers exactly two subscription cards', (html.match(/<article[^>]*class="conversion-price-card(?: conversion-price-card-pro)?"/g) ?? []).length === 2);
  check(pathname + ' presents ESSENTIEL and PRO', visible.includes('ESSENTIEL') && visible.includes('PRO'));
  check(pathname + ' keeps legacy plans off the public page', !/\b(?:Business|Premium)\b/.test(visible));
  check(pathname + ' has a PRO subscription action', html.includes('/parametres/abonnement?plan=pro&amp;billing=monthly'));
  check(pathname + ' describes the Essentiel free trial', /essai ESSENTIEL/.test(visible));
}
check('Home presents six families of complete ERP modules', htmls['/'].includes('id="pro"') && (htmls['/'].match(/<article class="pro-module"/g) ?? []).length === 6);
check('Conditions describe both offers', htmls['/conditions'].includes('ESSENTIEL') && htmls['/conditions'].includes('PRO'));
const target = '/parametres/abonnement?plan=pro&billing=yearly';
const redirect = await fetch(origin + target, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
const destination = new URL(redirect.headers.get('location') ?? '/', origin);
check('Anonymous PRO selection opens login with plan and period preserved', redirect.status === 307 && destination.pathname === '/login' && destination.searchParams.get('next') === target);
const denied = await fetch(origin + '/api/stripe/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ planCode: 'pro', billingInterval: 'monthly' }), signal: AbortSignal.timeout(30000) });
check('Anonymous checkout refuses before any billing action', denied.status === 401);
const response = await fetch(origin + '/images/felexia-horizon-v1.png', { signal: AbortSignal.timeout(30000) });
const remoteImage = Buffer.from(await response.arrayBuffer());
const expectedImage = await readFile(new URL('../../../public/images/felexia-horizon-v1.png', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
check('Landscape image remains unchanged', response.status === 200 && hash(remoteImage) === hash(expectedImage));
const report = { date: new Date().toISOString(), origin, passed: true, checks, imageSha256: hash(remoteImage), scope: 'Public GETs and anonymous denied checkout only; zero authorized billing or business mutations' };
await writeFile(new URL(origin.startsWith('http:') ? './local-public.json' : './production-public.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, origin, checks: checks.length }));
