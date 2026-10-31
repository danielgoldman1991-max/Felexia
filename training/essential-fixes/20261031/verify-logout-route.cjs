/* eslint-disable @typescript-eslint/no-require-imports -- Isolated authentication-route fixtures. */
// Real route and Next request/response; only Auth/SSR cookies/config are synthetic.
// No .env, project session, network, account, email or database is accessed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '../../..');
const results = [];
let scenario = {};
let authCalls = 0;
function check(value, name) { assert.ok(value, name); results.push(name); }
function load(file, dependencies) {
  const state = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: state, exports: state.exports, URL, console: { error() {} }, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error('Unexpected logout dependency: ' + name);
  } }, { filename: file });
  return state.exports;
}
const route = load('src/app/auth/logout/route.ts', {
  'next/server': require('next/server'),
  '@/lib/env': { requireSupabasePublicEnv() { if (scenario.configFailure) throw new Error('Private configuration sentinel'); return { supabaseUrl: 'https://fixture.example', supabaseAnonKey: 'fixture-public' }; } },
  '@supabase/ssr': { createServerClient(_url, _key, options) { return { auth: { async signOut(input) {
    authCalls++;
    assert.equal(input.scope, 'local', 'Signing out never revokes other device sessions');
    if (scenario.throwFailure) throw new Error('Private provider sentinel');
    if (scenario.authFailure) return { error: { code: 'unexpected_failure', message: 'Private provider sentinel' } };
    const incoming = options.cookies.getAll();
    assert.ok(incoming.some(cookie => cookie.name === 'sb-fixture-auth-token.0'));
    assert.ok(incoming.some(cookie => cookie.name === 'sb-fixture-auth-token.1'));
    options.cookies.setAll(incoming.filter(cookie => cookie.name.startsWith('sb-fixture-')).map(cookie => ({ ...cookie, value: '', options: { path: '/', maxAge: 0, sameSite: 'lax', httpOnly: true } })), { 'cache-control': 'private, no-store' });
    return { error: null };
  } } }; } },
});
function request({ host = 'www.felexia.pro', origin = 'https://' + host, fetchSite = 'same-origin', method = 'POST' } = {}) {
  const headers = { cookie: 'sb-fixture-auth-token.0=fixture-one; sb-fixture-auth-token.1=fixture-two; felexia_recovery=fixture-proof' };
  if (origin !== null) headers.origin = origin;
  if (fetchSite !== null) headers['sec-fetch-site'] = fetchSite;
  return new NextRequest('https://' + host + '/auth/logout', { method, headers });
}
async function post(settings = {}) { scenario = settings; authCalls = 0; return route.POST(request(settings)); }
async function main() {
  for (const role of ['admin', 'operator', 'viewer']) {
    for (const expired of [false, true]) {
      const response = await post({ role, expired });
      check(response.status === 303 && new URL(response.headers.get('location')).href === 'https://www.felexia.pro/login' && authCalls === 1, role + (expired ? ' expired' : ' active') + ' can sign out independently of financial permissions');
      check(response.cookies.get('sb-fixture-auth-token.0')?.value === '' && response.cookies.get('sb-fixture-auth-token.1')?.value === '' && response.cookies.get('sb-fixture-auth-token.0')?.maxAge === 0, 'All SSR session-cookie chunks are expired: ' + role + '/' + expired);
      check(response.cookies.get('felexia_recovery')?.value === '' && response.headers.get('cache-control') === 'no-store' && response.headers.get('pragma') === 'no-cache', 'Recovery proof is cleared and redirect is never cached: ' + role + '/' + expired);
    }
  }
  const apex = await post({ host: 'felexia.pro' });
  check(apex.status === 303 && new URL(apex.headers.get('location')).origin === 'https://felexia.pro', 'The exact apex request origin is supported without a cross-origin redirect');
  check((await post({ fetchSite: null })).status === 303, 'A same-origin POST remains supported when Fetch Metadata is unavailable');
  for (const settings of [
    { origin: null }, { origin: 'null' }, { origin: 'https://attacker.example' },
    { origin: 'https://felexia.pro' }, { origin: 'https://www.felexia.pro.attacker.example' },
    { fetchSite: 'cross-site' }, { fetchSite: 'same-site' },
  ]) {
    const response = await post(settings);
    check(response.status === 403 && authCalls === 0 && !response.headers.has('location') && response.headers.get('cache-control') === 'no-store', 'Missing, external, mismatched or cross-site origin is rejected before Auth: ' + JSON.stringify(settings));
  }
  for (const settings of [{ authFailure: true }, { throwFailure: true }, { configFailure: true }]) {
    const response = await post(settings); const body = await response.json();
    check(response.status === 503 && !response.headers.has('location') && response.headers.get('cache-control') === 'no-store' && /déconnexion/.test(body.error) && !JSON.stringify(body).includes('sentinel'), 'Auth/config failure is explicit and never reports successful logout: ' + Object.keys(settings)[0]);
  }
  authCalls = 0;
  const get = route.GET(request({ method: 'GET' }));
  check(get.status === 405 && get.headers.get('allow') === 'POST' && get.headers.get('cache-control') === 'no-store' && authCalls === 0 && get.cookies.getAll().length === 0, 'GET/prefetch never changes authentication state');
  const sidebar = ts.createSourceFile('sidebar.tsx', fs.readFileSync(path.join(root, 'src/components/layout/sidebar.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let dedicatedForm = false, legacyImport = false;
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(sidebar) === 'form') {
      const values = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => [attribute.name.getText(sidebar), attribute.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : null]));
      dedicatedForm ||= values.action === '/auth/logout' && values.method === 'post';
    }
    if (ts.isImportDeclaration(node) && node.getText(sidebar).includes('logoutAction')) legacyImport = true;
    ts.forEachChild(node, visit);
  }
  visit(sidebar);
  check(dedicatedForm && !legacyImport, 'Sidebar posts to the dedicated route instead of the current financial page');
  const proxy = load('src/proxy.ts', { '@/lib/supabase/middleware': { updateSession() { throw Error('Proxy must never run for logout'); } } });
  const matched = proxy.config.matcher.some(pattern => pattern === '/auth/logout' || pattern.endsWith('/:path*') && ('/auth/logout' === pattern.slice(0, -'/:path*'.length) || '/auth/logout'.startsWith(pattern.slice(0, -'/:path*'.length) + '/')));
  check(!matched, 'Dedicated logout route remains outside financial proxy matching');
  let legacyScope;
  const legacy = load('src/lib/auth-actions.ts', {
    'next/navigation': { redirect(destination) { throw new Error('REDIRECT:' + destination); } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { signOut: async input => { legacyScope = input.scope; return { error: null }; } } }) },
    '@/lib/auth': {}, '@/lib/saas': {},
  });
  await assert.rejects(legacy.logoutAction, /REDIRECT:\/login/);
  check(legacyScope === 'local', 'Legacy action also signs out only the current session');
  fs.writeFileSync(path.join(__dirname, 'logout-route-tests.json'), JSON.stringify({ success: true, checks: results.length, scope: 'Real route, Next request/response, sidebar AST and proxy matcher; synthetic Auth/SSR boundaries; zero network or accounts', results }, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, checks: results.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
