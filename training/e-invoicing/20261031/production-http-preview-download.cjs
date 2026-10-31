/* eslint-disable @typescript-eslint/no-require-imports -- Authorized production QA viewer download only. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createServerClient } = require('@supabase/ssr');
const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'production-http-preview-download.json');
const sourceId = '51279ec6-c2e1-4331-8b29-b496448bcbb6';
const versionId = 'be7ecb77-8909-4c47-bae8-d7a3fdbebd6e';
const requests = [];

async function main() {
  assert(process.argv.includes('--ready-confirmed'), 'Production READY confirmation required');
  const env = {};
  for (const line of (await fs.readFile(path.join(root, '.env.local'), 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY|ANON_KEY))\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  const origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  assert(new URL(origin).protocol === 'https:' && new URL(origin).hostname.endsWith('.supabase.co'));
  const fixture = JSON.parse(await fs.readFile(path.resolve(root, '../backups/essential-fixes-e2e-private.json'), 'utf8'));
  assert.equal(fixture.organizationId, '1eabead7-02ca-4d44-b147-2831d8799eaa');
  const account = fixture.users.viewer;
  const jar = new Map();
  async function readFetch(url, options = {}) {
    const target = new URL(typeof url === 'string' ? url : url.url ?? url.href);
    const method = (options.method ?? 'GET').toUpperCase();
    const login = target.origin === origin && target.pathname === '/auth/v1/token' && target.searchParams.get('grant_type') === 'password' && method === 'POST';
    const read = method === 'GET' && ((target.origin === origin && (target.pathname.startsWith('/rest/v1/') || target.pathname === '/auth/v1/user' || target.pathname === '/auth/v1/.well-known/jwks.json')) || target.origin === 'https://www.felexia.pro');
    assert(login || read, 'Only authorized QA login and production reads');
    const response = await fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(35000) });
    requests.push({ surface: target.origin === origin ? 'Supabase' : 'Felexia production', method, path: target.pathname, status: response.status });
    return response;
  }
  const sdk = createServerClient(origin, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: entries => { for (const item of entries) jar.set(item.name, item.value); } }, global: { fetch: readFetch } });
  const login = await sdk.auth.signInWithPassword({ email: account.email, password: account.password });
  assert(!login.error && login.data.user?.id === account.id, 'Existing QA viewer authenticated');
  const metadata = await sdk.from('einvoice_artifacts').select('id,document_id,version_id,format,sha256,byte_length').eq('organization_id', fixture.organizationId).eq('version_id', versionId).eq('format', 'pdf').maybeSingle();
  assert(!metadata.error && metadata.data, 'Viewer can read exact prepared PDF metadata');
  const response = await readFetch(`https://www.felexia.pro/facturation/electronique/factures/${sourceId}/download?format=pdf&version=${versionId}&lang=fr`, { headers: { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '), 'Cache-Control': 'no-store' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.equal(bytes.length, metadata.data.byte_length);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256, metadata.data.sha256);
  const file = path.resolve(root, '../backups/einvoice-production-qa/prepared-fr.pdf');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  await fs.writeFile(output, JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), role: 'viewer', qaOrganizationId: fixture.organizationId, sourceId, versionId, artifactId: metadata.data.id, bytes: bytes.length, sha256, file, requests, authorizedExistingQaLogins: 1, businessMutationRequests: 0, emailsRequested: 0 }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, file, artifactId: metadata.data.id, bytes: bytes.length, sha256, businessMutationRequests: 0 }));
}
main().catch(async error => {
  await fs.writeFile(output, JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), error: error.message, requests, businessMutationRequests: 0 }, null, 2) + '\n');
  console.error('QA preview download failed; see sanitized report.');
  process.exitCode = 1;
});
