/* eslint-disable @typescript-eslint/no-require-imports -- Isolated middleware fixture entry point. */
// Real middleware, role/launch/subscription helpers and Next request/response.
// Only the Auth/DB/deployment boundaries are synthetic; no project env or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '../../..');
const results = [];
let scenario;
let calls;
function load(file) {
  const absolute = path.isAbsolute(file) ? file : path.join(root, file);
  const moduleState = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module: moduleState, exports: moduleState.exports, URL, Date, console, require(name) {
    if (name === '@/lib/env') return { getEnv: () => ({ supabaseUrl: 'https://fixture.example', supabaseAnonKey: 'fixture-publishable' }) };
    if (name === '@/lib/launch-access') return { hasFullErpAccess: async () => false };
    if (name === '@supabase/ssr') return { createServerClient: (_url, _key, options) => ({
      auth: { async getUser() {
        options.cookies.setAll([{ name: 'fixture-session', value: 'refreshed', options: { httpOnly: true, path: '/' } }], { 'cache-control': 'private, no-store', pragma: 'no-cache' });
        return { data: { user: scenario.anonymous ? null : { id: 'fixture-user' } }, error: null };
      } },
      from(table) {
        calls.push(table);
        const q = { select() { return q; }, eq() { return q; }, limit() { return q; }, order() { return q; }, async maybeSingle() {
          if (table === 'organization_members') return { data: { organization_id: 'fixture-company', role: scenario.arrayRole ? [{ name: scenario.role }] : { name: scenario.role } }, error: scenario.membershipError ? { code: 'fixture_unavailable' } : null };
          if (table === 'organization_subscriptions') return { data: { status: 'trialing', trial_ends_at: new Date(Date.now() + (scenario.expired ? -1 : 1) * 86400000).toISOString() }, error: scenario.subscriptionError ? { code: 'fixture_unavailable' } : null };
          throw new Error('Unexpected middleware read: ' + table);
        } };
        return q;
      },
    }) };
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), name) + '.ts');
    return require(name);
  } }, { filename: absolute });
  return moduleState.exports;
}
const middleware = load('src/lib/supabase/middleware.ts');
async function check(name, options, expected) {
  scenario = { role: 'viewer', ...options };
  calls = [];
  const response = await middleware.updateSession(new NextRequest('https://www.felexia.pro' + scenario.path, { method: scenario.method || 'POST' }));
  assert.equal(response.status, expected.status, name);
  if (expected.code) assert.equal((await response.json()).code, expected.code, name);
  if (expected.destination) assert.equal(new URL(response.headers.get('location')).pathname, expected.destination, name);
  if (expected.passthrough) assert.equal(response.headers.get('x-middleware-next'), '1', name);
  assert.equal(response.cookies.get('fixture-session')?.value, 'refreshed', 'Refreshed session cookie is preserved: ' + name);
  assert.equal(response.headers.get('cache-control'), expected.code ? 'no-store' : 'private, no-store', 'Response cannot become publicly cached: ' + name);
  if (scenario.path.startsWith('/parametres/')) assert.equal(calls.includes('organization_subscriptions'), false, 'Personal settings do not initialize or require financial billing state');
  results.push(name);
}
async function main() {
  for (const route of ['profil', 'preferences', 'securite']) {
    await check('Active viewer may update own ' + route, { path: '/parametres/' + route }, { status: 200, passthrough: true });
    await check('Expired viewer may update own ' + route, { path: '/parametres/' + route, expired: true, arrayRole: true }, { status: 200, passthrough: true });
    await check('Operator may update own ' + route, { path: '/parametres/' + route, role: 'operator' }, { status: 200, passthrough: true });
  }
  await check('Viewer financial POST is forbidden', { path: '/facturation/factures/new' }, { status: 403, code: 'READ_ONLY_ACCESS' });
  await check('Viewer financial form redirects to consultation', { path: '/facturation/factures/new', method: 'GET' }, { status: 307, destination: '/dashboard' });
  await check('Expired administrator financial POST is forbidden', { path: '/facturation/factures/new', role: 'admin', expired: true }, { status: 403, code: 'SUBSCRIPTION_WRITE_REQUIRED' });
  await check('Expired operator financial POST is forbidden', { path: '/achats/factures/new', role: 'operator', expired: true }, { status: 403, code: 'SUBSCRIPTION_WRITE_REQUIRED' });
  await check('Expired viewer retains CSV export access', { path: '/api/exports/sales', method: 'GET', expired: true }, { status: 200, passthrough: true });
  await check('Anonymous personal POST redirects to login', { path: '/parametres/profil', anonymous: true }, { status: 307, destination: '/login' });
  await check('Membership failure still blocks personal POST', { path: '/parametres/securite', membershipError: true }, { status: 403, code: 'READ_ONLY_ACCESS' });
  await check('Subscription lookup error fails financial writes closed', { path: '/achats/factures/new', role: 'admin', subscriptionError: true }, { status: 403, code: 'SUBSCRIPTION_WRITE_REQUIRED' });
  fs.writeFileSync(path.join(__dirname, 'middleware-access-tests.json'), JSON.stringify({ success: true, checks: results.length, scope: 'Real middleware and Next request/response; isolated Auth/DB/deployment; zero network or project secrets', refreshedCookiesAndPrivateCacheRetained: true, results }, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, checks: results.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
