/* Current request policy and billing routes, synthetic Auth/DB/Stripe only. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../../..');
const results = [];
function check(value, label) { assert(value, label); results.push(label); }
function fixture() {
  const state = { now: 1_800_000_000_000, role: 'admin', authenticated: true, calls: { stripe: 0, db: 0, auth: 0 }, configuredUrl: 'https://felexia.pro' };
  const cache = new Map();
  class Clock extends Date { static now() { return state.now; } }
  const stripe = { customers: { retrieve: async () => { state.calls.stripe++; return { id: 'cus_fixture', metadata: { organization_id: 'organization' } }; } } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } },
    '@/lib/auth': { getActiveWorkspace: async () => { state.calls.auth++; return state.authenticated ? { role: state.role, email: 'admin@example.test', organization: { id: 'organization', name: 'Fixture' } } : null; } },
    '@/lib/auth/roles': { isAdminRole: role => ['admin', 'owner'].includes(role), isOperatorRole: role => role === 'operator' },
    '@/lib/auth/operator-access': { OPERATOR_ACCESS_ERROR: 'Operator denied' },
    '@/lib/env': { hasStripeEnv: () => true },
    '@/lib/app-url': { getAppUrl: () => state.configuredUrl },
    '@/lib/supabase/service': { createClient: () => ({
      rpc: async name => { state.calls.db++; return { data: name === 'claim_billing_checkout' ? null : null, error: null }; },
      from: () => { state.calls.db++; const q = { select() { return q; }, eq() { return q; }, single: async () => ({ data: { stripe_customer_id: 'cus_fixture' }, error: null }) }; return q; },
    }) },
    '@/lib/stripe': {
      getStripePriceIdForPlan: () => 'price_essentiel_monthly',
      assertStripePriceMatchesPlan: async () => { state.calls.stripe++; },
      getStripe: () => stripe,
      createPortalSession: async () => { state.calls.stripe++; return { url: 'https://billing.stripe.test/fixture' }; },
      createStripeCustomer: async () => { throw Error('Unexpected customer write'); },
      createPlanCheckoutSession: async () => { throw Error('Unexpected Checkout write'); },
    },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} }; cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, Date: Clock, URL, Map, console: { error() {} }, require(id) { if (id in mocks) return mocks[id]; if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts'); throw Error('Unexpected dependency ' + id); } }, { filename: file });
    cache.set(file, module.exports); return module.exports;
  }
  return { state, policy: load('src/lib/billing-request-policy.ts'), checkout: load('src/app/api/stripe/checkout/route.ts'), portal: load('src/app/api/stripe/portal/route.ts') };
}
function request({ origin = 'https://www.felexia.pro', fetchSite = 'same-origin', url = 'https://www.felexia.pro/api/stripe/checkout', body = { planCode: 'essentiel', billingInterval: 'monthly' } } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (origin !== null) headers.origin = origin;
  if (fetchSite !== null) headers['sec-fetch-site'] = fetchSite;
  return new Request(url, { method: 'POST', headers, body: JSON.stringify(body) });
}
async function main() {
  for (const settings of [{ origin: 'https://evil.example', fetchSite: 'cross-site' }, { origin: null }, { origin: 'null' }, { origin: 'https://www.felexia.pro', fetchSite: 'cross-site' }, { origin: 'https://www.felexia.pro.evil.example' }]) {
    for (const route of ['checkout', 'portal']) {
      const f = fixture(); const response = await f[route].POST(request(settings)); const body = await response.json();
      check(response.status === 403 && body.code === 'BILLING_ORIGIN_NOT_ALLOWED' && f.state.calls.stripe === 0 && f.state.calls.db === 0, route + ' bad or absent browser origin is rejected before external work: ' + JSON.stringify(settings));
      check(response.headers.get('cache-control') === 'private, no-store', route + ' origin refusal is not cached');
    }
  }
  for (const settings of [{}, { origin: 'https://felexia.pro', fetchSite: 'same-site' }, { origin: 'https://preview.vercel.app', url: 'https://preview.vercel.app/api/stripe/checkout' }, { fetchSite: null }]) {
    const f = fixture(); check(f.policy.getBillingRequestRejection(request(settings), 'normal-org') === null, 'Exact same-origin, configured apex, preview and missing optional Fetch Metadata remain usable: ' + JSON.stringify(settings));
  }
  const f = fixture();
  for (let i = 0; i < 10; i++) assert.equal(f.policy.getBillingRequestRejection(request(), 'rate-org'), null);
  const limited = f.policy.getBillingRequestRejection(request(), 'rate-org'); check(limited.status === 429 && limited.retryAfter === 60, 'Eleventh request per company per minute is limited');
  check(f.policy.getBillingRequestRejection(request(), 'another-org') === null, 'Rate limiting is scoped to company');
  for (let minute = 1; minute < 6; minute++) { f.state.now += 60_000; for (let i = 0; i < 10; i++) assert.equal(f.policy.getBillingRequestRejection(request(), 'rate-org'), null); }
  const hourly = f.policy.getBillingRequestRejection(request(), 'rate-org'); check(hourly.status === 429 && hourly.retryAfter === 3300, 'Hourly cap returns time until the longest exhausted window resets');
  f.state.now += 3_300_000; check(f.policy.getBillingRequestRejection(request(), 'rate-org') === null, 'Minute and hour budgets expire without permanent lockout');
  for (const route of ['checkout', 'portal']) {
    const auth = fixture(); auth.state.authenticated = false; check((await auth[route].POST(request({ origin: null }))).status === 401 && auth.state.calls.stripe === 0, route + ' anonymous refusal stays 401 before origin and Stripe');
    for (const role of ['viewer', 'operator']) { const denied = fixture(); denied.state.role = role; check((await denied[route].POST(request())).status === 403 && denied.state.calls.stripe === 0 && denied.state.calls.db === 0, route + ' role ' + role + ' cannot use billing'); }
    const shared = fixture(); for (let i = 0; i < 10; i++) shared.policy.getBillingRequestRejection(request(), 'organization');
    const response = await shared[route].POST(request()); check(response.status === 429 && response.headers.get('retry-after') === '60' && shared.state.calls.stripe === 0 && shared.state.calls.db === 0, route + ' applies shared policy and Retry-After before external calls');
  }
  for (const code of ['premium', 'pro', 'business']) {
    const f = fixture(); const response = await f.checkout.POST(request({ body: { planCode: code, billingInterval: 'monthly' } }));
    check(response.status === 400 && f.state.calls.stripe === 0 && f.state.calls.db === 0, code + ' remains non-self-service after request guard');
  }
  const allowedCheckout = fixture(); check((await allowedCheckout.checkout.POST(request())).status === 409 && allowedCheckout.state.calls.stripe === 1 && allowedCheckout.state.calls.db === 1, 'Allowed Checkout reaches existing price and SQL lease boundary without creating a session');
  const allowedPortal = fixture(); const portalResponse = await allowedPortal.portal.POST(request()); check(portalResponse.status === 200 && (await portalResponse.json()).url.startsWith('https://billing.stripe.test/') && allowedPortal.state.calls.stripe === 2, 'Allowed portal preserves scoped customer ownership and session preparation on synthetic Stripe');
  fs.writeFileSync(path.join(__dirname, 'billing-security-fixtures.json'), JSON.stringify({ passed: true, assertions: results.length, scope: 'Real origin/rate policy and both handlers. Auth, NextResponse, database, Stripe, clock and app URL are synthetic. Limits are per process, not distributed.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, assertions: results.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
