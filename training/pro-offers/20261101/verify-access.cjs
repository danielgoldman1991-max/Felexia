/* eslint-disable @typescript-eslint/no-require-imports -- Isolated behavioral fixtures. */
// Real TypeScript modules run in a VM with synthetic auth, DB and environment.
// No dotenv, credentials, network, hosted data, payments or external side effects.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '../../..');
const company = '11111111-2222-4333-8444-555555555555';
const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const environment = {};
const results = [];
let scenario;
let traces;

function equal(actual, expected, label) {
  assert.equal(actual, expected, label);
  results.push(label);
}
function reset(options = {}) {
  for (const key of Object.keys(environment)) delete environment[key];
  scenario = { planCode: 'premium', role: 'admin', expired: false, ...options };
  traces = { entitlementReads: [], catalogReads: [], businessEffects: [], serverClients: 0, suppliedClientReads: 0 };
}
function effect(label) {
  traces.businessEffects.push(label);
  throw new Error('BUSINESS_BOUNDARY:' + label);
}
function rawSubscription() {
  return scenario.noSubscription ? null : {
    plan_code: scenario.planCode,
    status: scenario.status || 'active',
    current_period_end: scenario.expired ? past : future,
    trial_ends_at: scenario.expired ? past : future,
  };
}
function workspace() {
  const subscription = rawSubscription();
  return {
    userId: 'fixture-user', email: 'fixture@example.invalid', role: scenario.role,
    organization: { id: company, name: 'Fixture company', slug: 'fixture' },
    subscription: subscription ? {
      planCode: subscription.plan_code, status: subscription.status,
      currentPeriodEnd: subscription.current_period_end, trialEndsAt: subscription.trial_ends_at,
    } : null,
    enabledModules: [],
  };
}
function database({ supplied = false, membership = false } = {}) {
  return {
    auth: { async getUser() { return { data: { user: scenario.anonymous ? null : { id: 'fixture-user' } } }; } },
    get storage() { return effect('storage'); },
    rpc() { return effect('rpc'); },
    from(table) {
      if (scenario.catalog && ['products', 'tax_rates'].includes(table)) {
        traces.catalogReads.push(table);
        const query = {
          select() { return query; }, eq() { return query; },
          insert() { return effect('insert:' + table); }, update() { return effect('update:' + table); },
          delete() { return effect('delete:' + table); },
          async single() { return { data: { rate: 20 }, error: null }; },
          async maybeSingle() { return { data: scenario.existingProduct, error: null }; },
        };
        return query;
      }
      if (table !== 'organization_subscriptions' && !(membership && table === 'organization_members')) {
        return effect('db:' + table);
      }
      const read = { table, filters: [] };
      traces.entitlementReads.push(read);
      if (supplied) traces.suppliedClientReads++;
      const query = {
        select(fields) { read.fields = fields; return query; },
        eq(key, value) { read.filters.push([key, value]); return query; },
        order() { return query; }, limit() { return query; },
        insert() { return effect('insert:' + table); }, update() { return effect('update:' + table); },
        upsert() { return effect('upsert:' + table); }, delete() { return effect('delete:' + table); },
        async maybeSingle() {
          if (scenario.throwLookup && table === 'organization_subscriptions') throw new Error('Synthetic lookup unavailable');
          if (table === 'organization_members') return {
            data: scenario.noMembership ? null : { organization_id: company, role: scenario.arrayRole ? [{ name: scenario.role }] : { name: scenario.role } },
            error: scenario.membershipError ? { code: 'fixture_membership_error' } : null,
          };
          return { data: rawSubscription(), error: scenario.lookupError ? { code: 'fixture_lookup_error' } : null };
        },
      };
      return query;
    },
  };
}
const moduleCache = new Map();
const genericBoundary = new Proxy({}, { get(_target, key) {
  if (key === '__esModule') return true;
  return () => effect('dependency:' + String(key));
} });
function load(relative) {
  const absolute = path.resolve(root, relative);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute);
  const moduleState = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module: moduleState, exports: moduleState.exports, URL, Date, Error, FormData, File, Buffer,
    process: { env: environment }, console: { error() {}, warn() {} },
    fetch: () => effect('network'),
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'react') return { cache: fn => fn };
      if (name === 'crypto') return { randomUUID: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' };
      if (name === '@/lib/env') return { getEnv: () => ({ supabaseUrl: 'https://fixture.example.invalid', supabaseAnonKey: 'fixture-publishable' }) };
      if (name === '@/lib/auth') return { requireActiveWorkspace: async () => workspace() };
      if (name === '@/lib/supabase/server') return { createClient: async () => { traces.serverClients++; return database(); } };
      if (name === '@supabase/ssr') return { createServerClient: (_url, _key, options) => {
        const client = database({ supplied: true, membership: true });
        client.auth.getUser = async () => {
          options.cookies.setAll([{ name: 'fixture-session', value: 'refreshed', options: { httpOnly: true, path: '/' } }], { 'cache-control': 'private, no-store', pragma: 'no-cache' });
          return { data: { user: scenario.anonymous ? null : { id: 'fixture-user' } } };
        };
        return client;
      } };
      if (name === 'next/server') return require('next/server');
      const real = new Set([
        '@/lib/launch-access', '@/lib/pro-access', '@/lib/launch-profile',
        '@/lib/auth/roles', '@/lib/auth/operator-access', '@/lib/subscriptions/subscription-access',
      ]);
      if (real.has(name)) return load('src/' + name.slice(2) + '.ts');
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(absolute), name) + '.ts'));
      return genericBoundary;
    },
  }, { filename: absolute });
  moduleCache.set(absolute, moduleState.exports);
  return moduleState.exports;
}

reset();
const launch = load('src/lib/launch-access.ts');
const pro = load('src/lib/pro-access.ts');
const middleware = load('src/lib/supabase/middleware.ts');
const actionCases = [
  { label: 'GED upload', file: 'src/lib/document-actions.ts', name: 'uploadDocumentAction', form: () => {
    const form = new FormData(); form.set('file', new File(['%PDF-fixture'], 'fixture.pdf', { type: 'application/pdf' })); return form;
  } },
  { label: 'TVA autofix', file: 'src/lib/tax/vat-declaration-actions.ts', name: 'autoFixVatDeclarationAnomaliesAction', fields: { id: 'fixture-declaration' } },
  { label: 'Manual stock', file: 'src/lib/stock-actions.ts', name: 'createManualStockEntry', fields: { product_id: 'fixture-product', quantity: '1' } },
  { label: 'Custom chart account', file: 'src/lib/accounting-actions.ts', name: 'createChartOfAccount', fields: { code: '12345', name: 'Fixture account' } },
];
function actionForm(item) {
  if (item.form) return item.form();
  const form = new FormData();
  for (const [key, value] of Object.entries(item.fields)) form.set(key, value);
  return form;
}
async function rejectWithoutEffects(operation, pattern, label) {
  await assert.rejects(operation, pattern, label);
  results.push(label + ': denied');
  equal(traces.businessEffects.length, 0, label + ': zero DB writes, storage, RPC or downstream effects');
}

async function launchCases() {
  for (const planCode of ['premium', 'pro']) for (const expired of [false, true]) {
    reset({ planCode, expired });
    equal(await launch.hasFullErpAccess(company), true, planCode + ' retains full reads, expired=' + expired);
    equal(traces.entitlementReads[0].filters.some(([key, value]) => key === 'organization_id' && value === company), true, 'Full entitlement is scoped to authenticated company');
  }
  for (const options of [
    { planCode: 'essentiel' }, { planCode: 'business' }, { noSubscription: true },
    { lookupError: true }, { throwLookup: true }, { planCode: 'unknown' },
  ]) {
    reset(options);
    equal(await launch.hasFullErpAccess(company), false, 'Unavailable full entitlement fails closed: ' + JSON.stringify(options));
  }
  reset();
  equal(await launch.hasFullErpAccess(''), false, 'Empty company cannot open PRO');
  equal(traces.serverClients, 0, 'Empty company does not query a database');
  reset({ planCode: 'essentiel' });
  environment.FELEXIA_ERP_MODE = ' FULL ';
  equal(await launch.hasFullErpAccess(company), true, 'Deployment full override remains available');
  equal(traces.serverClients, 0, 'Deployment full override does not read billing');
  reset({ planCode: 'essentiel' });
  environment.FELEXIA_FULL_ERP_ORGANIZATION_IDS = ' other, ' + company.toUpperCase() + ', last ';
  equal(await launch.hasFullErpAccess(company), true, 'Company allowlist remains available with spaces/case');
  equal(await launch.hasFullErpAccess('22222222-3333-4444-8555-666666666666'), false, 'Allowlist cannot grant another company access');
  reset({ planCode: 'premium' });
  equal(await launch.hasFullErpAccess(company, database({ supplied: true })), true, 'Middleware client can resolve real PRO entitlement');
  equal(traces.serverClients, 0, 'Supplied Supabase client avoids creating a cookie-bound server client');
  equal(traces.suppliedClientReads, 1, 'Entitlement uses the supplied Supabase client');
  equal(traces.businessEffects.length, 0, 'Entitlement resolution is read only');
}

async function helperCases() {
  for (const role of ['admin', 'owner', 'manager', 'accountant', 'sales']) {
    reset({ role });
    equal((await pro.requireProWorkspace()).role, role, 'Active PRO write helper preserves existing role scope: ' + role);
  }
  for (const [options, pattern, label] of [
    [{ planCode: 'essentiel' }, /offre PRO/, 'ESSENTIEL'],
    [{ planCode: 'business' }, /offre PRO/, 'Legacy Business'],
    [{ expired: true }, /consultation/, 'Expired PRO'],
    [{ noSubscription: true }, /offre PRO/, 'Missing subscription'],
    [{ role: 'viewer' }, /rôle/, 'PRO viewer'],
    [{ role: 'operator' }, /rôle/, 'PRO operator'],
    [{ lookupError: true }, /offre PRO/, 'Entitlement read error'],
  ]) {
    reset(options);
    await rejectWithoutEffects(() => pro.requireProWorkspace(), pattern, label + ' helper');
  }
  reset({ expired: true, role: 'viewer' });
  equal((await pro.requireProWorkspace({ write: false })).organization.id, company, 'Explicit PRO read preserves expired viewer consultation');
}

async function guardedActions() {
  for (const item of actionCases) {
    const action = load(item.file)[item.name];
    for (const [options, pattern, label] of [
      [{ planCode: 'essentiel' }, /offre PRO/, 'ESSENTIEL'],
      [{ expired: true }, /consultation/, 'Expired PRO'],
      [{ role: 'viewer' }, /rôle/, 'PRO viewer'],
      [{ role: 'operator' }, /rôle/, 'PRO operator'],
    ]) {
      reset(options);
      await rejectWithoutEffects(() => action({}, actionForm(item)), pattern, item.label + ' / ' + label);
    }
    reset();
    await assert.rejects(() => action({}, actionForm(item)), /BUSINESS_BOUNDARY:/, item.label + ' permits active PRO to reach the isolated work boundary');
    results.push(item.label + ': active PRO positive control reaches work boundary');
    equal(traces.businessEffects.length, 1, item.label + ': positive control performs precisely one attempted work boundary');
  }
  const products = load('src/lib/product-actions.ts');
  reset({ planCode: 'essentiel' });
  const tracked = new FormData();
  for (const [key, value] of Object.entries({ type: 'product', name: 'Fixture', track_stock: 'on', current_stock: '1' })) tracked.set(key, value);
  await rejectWithoutEffects(() => products.createProduct({}, tracked), /offre PRO/, 'Forged initial product stock');
  const simpleProductForm = () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ id: 'fixture-product', type: 'product', name: 'Fixture', tax_rate_id: 'fixture-tax', category_id: 'fixture-category', track_stock: 'off', min_stock: '0' })) form.set(key, value);
    return form;
  };
  reset({ planCode: 'essentiel', catalog: true });
  await assert.rejects(() => products.createProduct({}, simpleProductForm()), /BUSINESS_BOUNDARY:insert:products/, 'ESSENTIEL simple catalogue creation remains available');
  results.push('ESSENTIEL simple catalogue creation reaches isolated product insert');
  equal(traces.entitlementReads.length, 0, 'Simple ESSENTIEL product does not require PRO entitlement');
  reset({ planCode: 'essentiel', catalog: true, existingProduct: { current_stock: 0, track_stock: false, min_stock: 0, stock_alert_enabled: false } });
  const change = simpleProductForm(); change.set('track_stock', 'on');
  await rejectWithoutEffects(() => products.updateProduct({}, change), /offre PRO/, 'Forged product stock settings update');
  reset({ planCode: 'essentiel', catalog: true, existingProduct: { current_stock: 7, track_stock: true, min_stock: 2, stock_alert_enabled: true } });
  const preserved = simpleProductForm(); preserved.set('track_stock', 'on'); preserved.set('min_stock', '2'); preserved.set('stock_alert_enabled', 'on');
  await assert.rejects(() => products.updateProduct({}, preserved), /BUSINESS_BOUNDARY:update:products/, 'ESSENTIEL may edit a historical product without changing stock settings');
  results.push('ESSENTIEL catalogue edit preserves historical stock settings');
  equal(traces.entitlementReads.length, 0, 'Preserved historical stock settings do not require PRO entitlement');
}

async function middlewareCase(label, options, expected) {
  reset(options);
  const response = await middleware.updateSession(new NextRequest('https://fixture.example.invalid' + (options.path || '/stock'), { method: options.method || 'GET' }));
  equal(response.status, expected.status, label + ': HTTP status');
  if (expected.code) equal((await response.json()).code, expected.code, label + ': refusal reason');
  if (expected.destination) equal(new URL(response.headers.get('location')).pathname, expected.destination, label + ': redirect');
  if (expected.passthrough) equal(response.headers.get('x-middleware-next'), '1', label + ': request passes through');
  equal(response.cookies.get('fixture-session')?.value, 'refreshed', label + ': refreshed session retained');
  equal(traces.businessEffects.length, 0, label + ': middleware has no business mutation');
  equal(traces.serverClients, 0, label + ': entitlement uses middleware Supabase client');
}
async function middlewareCases() {
  await middlewareCase('Active PRO advanced GET', {}, { status: 200, passthrough: true });
  await middlewareCase('PRO alias advanced GET', { planCode: 'pro' }, { status: 200, passthrough: true });
  await middlewareCase('Expired PRO advanced consultation', { expired: true }, { status: 200, passthrough: true });
  await middlewareCase('Expired PRO advanced POST', { expired: true, method: 'POST' }, { status: 403, code: 'SUBSCRIPTION_WRITE_REQUIRED' });
  await middlewareCase('Expired PRO advanced creation form', { expired: true, path: '/vente/devis/new' }, { status: 307, destination: '/dashboard' });
  await middlewareCase('ESSENTIEL advanced GET', { planCode: 'essentiel' }, { status: 307, destination: '/parametres/modules' });
  await middlewareCase('ESSENTIEL advanced POST', { planCode: 'essentiel', method: 'POST' }, { status: 403, code: 'PRO_PLAN_REQUIRED' });
  await middlewareCase('Legacy Business advanced GET', { planCode: 'business' }, { status: 307, destination: '/parametres/modules' });
  await middlewareCase('PRO viewer advanced consultation', { role: 'viewer', arrayRole: true }, { status: 200, passthrough: true });
  await middlewareCase('PRO viewer advanced POST', { role: 'viewer', method: 'POST' }, { status: 403, code: 'READ_ONLY_ACCESS' });
  await middlewareCase('PRO viewer advanced form', { role: 'viewer', path: '/stock/entrees/new' }, { status: 307, destination: '/dashboard' });
  await middlewareCase('PRO operator advanced GET', { role: 'operator' }, { status: 307, destination: '/dashboard' });
  await middlewareCase('PRO operator advanced POST', { role: 'operator', method: 'POST' }, { status: 403, code: 'OPERATOR_ACCESS_DENIED' });
  await middlewareCase('Subscription failure blocks PRO POST', { lookupError: true, method: 'POST' }, { status: 403, code: 'SUBSCRIPTION_WRITE_REQUIRED' });
  await middlewareCase('Entitlement failure blocks advanced GET', { lookupError: true }, { status: 307, destination: '/parametres/modules' });
  await middlewareCase('Anonymous advanced GET preserves login return', { anonymous: true }, { status: 307, destination: '/login' });
  await middlewareCase('ESSENTIEL normal invoice GET', { planCode: 'essentiel', path: '/facturation/factures' }, { status: 200, passthrough: true });
}

async function main() {
  await launchCases();
  await helperCases();
  await guardedActions();
  await middlewareCases();
  const report = {
    success: true, assertions: results.length,
    scope: 'Real launch-access, pro-access, roles, subscription policy, selected Server Actions and Next middleware; synthetic Auth/DB/environment only',
    network: false, projectSecretsLoaded: false, hostedWrites: false,
    limitation: 'Synthetic boundaries validate control flow; hosted RLS and real browser sessions require separate verification.',
    results,
  };
  fs.writeFileSync(path.join(__dirname, 'access-fixtures.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, assertions: report.assertions }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
