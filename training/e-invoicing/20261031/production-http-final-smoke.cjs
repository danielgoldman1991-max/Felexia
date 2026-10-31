/* eslint-disable @typescript-eslint/no-require-imports -- Final production read-only rollout verification. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createServerClient } = require('@supabase/ssr');
const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'production-http-final-smoke.json');
const requests = [], checks = [];
const check = (name, actual, expected = true) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function main() {
  assert(process.argv.includes('--ready-confirmed'), 'Final deployment READY confirmation required');
  const env = {};
  for (const line of (await fs.readFile(path.join(root, '.env.local'), 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY|ANON_KEY))\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  const origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  assert(new URL(origin).protocol === 'https:' && new URL(origin).hostname.endsWith('.supabase.co'));
  let authLogins = 0;
  async function readFetch(url, options = {}) {
    const target = new URL(typeof url === 'string' ? url : url.url ?? url.href), method = (options.method ?? 'GET').toUpperCase();
    const login = target.origin === origin && target.pathname === '/auth/v1/token' && target.searchParams.get('grant_type') === 'password' && method === 'POST';
    const read = method === 'GET' && ((target.origin === origin && (target.pathname.startsWith('/rest/v1/') || target.pathname === '/auth/v1/user' || target.pathname === '/auth/v1/.well-known/jwks.json')) || target.origin === 'https://www.felexia.pro');
    assert(login || read, 'Only explicit existing QA login and GET requests are permitted');
    if (login) authLogins++;
    const response = await fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(35000) });
    requests.push({ surface: target.origin === origin ? 'Supabase' : 'Felexia production', method, path: target.pathname, status: response.status });
    return response;
  }
  async function login(account, id) {
    const jar = new Map();
    const sdk = createServerClient(origin, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: items => { for (const item of items) jar.set(item.name, item.value); } }, global: { fetch: readFetch } });
    const result = await sdk.auth.signInWithPassword({ email: account.email, password: account.password });
    check('Existing authorized QA identity authenticates', !result.error && result.data.user?.id === id);
    const get = async url => readFetch(`https://www.felexia.pro${url}`, { headers: { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '), 'Cache-Control': 'no-store' } });
    return { sdk, get };
  }
  const old = JSON.parse(await fs.readFile(path.resolve(root, '../backups/launch-e2e-private.json'), 'utf8'));
  const qa = JSON.parse(await fs.readFile(path.resolve(root, '../backups/essential-fixes-e2e-private.json'), 'utf8'));
  check('The original nonpilot QA company is explicitly identified', old.organizationId, 'c7728100-6e58-46b6-aa07-220b262169ab');
  const oldAdmin = await login({ email: old.adminEmail, password: old.password }, old.adminUserId);
  const before = await oldAdmin.sdk.from('einvoice_settings').select('enabled,connector_mode').eq('organization_id', old.organizationId).maybeSingle();
  assert.ifError(before.error);
  check('The nonpilot QA organization remains unactivated', before.data?.enabled ?? false, false);
  const page = await oldAdmin.get('/facturation/electronique?lang=fr');
  check('The final deployment serves the nonpilot admin module', page.status, 200);
  check('The nonpilot authenticated page disables shared caching', /no-store/.test(page.headers.get('cache-control') || ''));
  const html = await page.text();
  check('Global rollout exposes opt-in activation to another organization', html.includes('data-service-state="activation_required"'));
  check('The nonpilot admin has an activation link', html.includes('Activer le module'));
  check('The nonpilot module does not claim an unfinished deployment', !html.includes('data-service-state="deployment_required"'));
  const configuration = await oldAdmin.get('/facturation/electronique/configuration?lang=fr');
  check('The nonpilot administrator can open activation settings', configuration.status, 200);
  const configurationHtml = await configuration.text();
  check('The nonpilot activation form is available', /name="enabled"/.test(configurationHtml) && /\$ACTION_(?:ID|REF)_/.test(configurationHtml));
  const after = await oldAdmin.sdk.from('einvoice_settings').select('enabled,connector_mode').eq('organization_id', old.organizationId).maybeSingle();
  assert.ifError(after.error);
  check('Reading opt-in pages never activates or creates settings', after.data, before.data);
  const preview = JSON.parse(await fs.readFile(path.join(__dirname, 'production-http-preview-download.json'), 'utf8'));
  const viewer = await login(qa.users.viewer, qa.users.viewer.id);
  const list = await viewer.get('/facturation/electronique?lang=fr');
  check('Final deployment still serves the pilot reader', list.status, 200);
  const listHtml = await list.text();
  check('Final deployment reader list has no mutation form', !/<form[^>]*method="post"|\$ACTION_(?:ID|REF)_/.test(listHtml));
  const detailPath = `/facturation/electronique/factures/${preview.sourceId}`;
  const detail = await viewer.get(`${detailPath}?lang=fr`);
  check('Final deployment serves the issued detail', detail.status, 200);
  const detailHtml = await detail.text();
  check('Final deployment retains issued and archived state', detailHtml.includes('Émise et archivée'));
  check('Final deployment reader detail has no mutation form', !/<form[^>]*method="post"|\$ACTION_(?:ID|REF)_/.test(detailHtml));
  const artifacts = await viewer.sdk.from('einvoice_artifacts').select('format,sha256,byte_length').eq('organization_id', qa.organizationId).eq('version_id', preview.versionId);
  assert.ifError(artifacts.error);
  check('The final deployment keeps both immutable formats', artifacts.data.map(item => item.format).sort(), ['pdf', 'xml']);
  const downloads = [];
  for (const item of artifacts.data) {
    const result = await viewer.get(`${detailPath}/download?format=${item.format}&version=${preview.versionId}`);
    check(`Final reader download ${item.format} succeeds`, result.status, 200);
    check('Final archive disables caching', result.headers.get('cache-control'), 'private, no-store');
    const bytes = Buffer.from(await result.arrayBuffer());
    check('Final download preserves its immutable byte count', bytes.length, item.byte_length);
    check('Final download preserves its immutable SHA256', hash(bytes), item.sha256);
    downloads.push({ format: item.format, sha256: item.sha256, bytes: bytes.length });
  }
  check('The final PDF is exactly the previewed and issued file', downloads.find(item => item.format === 'pdf').sha256, preview.sha256);
  const health = await readFetch('https://www.felexia.pro/api/health');
  check('Final public health endpoint succeeds', health.status, 200);
  await fs.writeFile(output, JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), deployment: 'dpl_wA2oqwzYL8cfcTAWraUns1iF8bL1', commit: 'b02c42b', checks: checks.length, results: checks, nonpilotOrganizationId: old.organizationId, nonpilotActivated: false, pilotOrganizationId: qa.organizationId, sourceId: preview.sourceId, versionId: preview.versionId, downloads, requests, authorizedExistingQaLogins: authLogins, businessMutationRequests: 0, emailsRequested: 0, notes: ['Only existing authorized QA identities were used; normal Auth sessions/audit entries are distinct from business changes.', 'No activation, emission, preparation or other business mutation was submitted.'] }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length, requests: requests.length, authLogins, businessMutationRequests: 0 }));
}
main().catch(async error => {
  await fs.writeFile(output, JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), checks: checks.length, results: checks, requests, error: error.message, businessMutationRequests: 0, emailsRequested: 0 }, null, 2) + '\n');
  console.error('Final read-only QA smoke failed; see sanitized report.'); process.exitCode = 1;
});
