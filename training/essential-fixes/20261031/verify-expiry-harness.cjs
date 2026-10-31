/* eslint-disable @typescript-eslint/no-require-imports -- Isolated harness safety fixtures. */
// Exercises the real expiry harness with synthetic SDK/filesystem boundaries.
// No project environment, real manifest, credential, database or network is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const filename = path.join(root, 'scripts/verify-essential-expiry.cjs');
const source = fs.readFileSync(filename, 'utf8').replace('main().catch(error => {', 'const fixtureExecution = main().catch(error => {') + '\nmodule.exports = fixtureExecution;';
const ids = { org: '10000000-0000-4000-8000-000000000001', admin: '20000000-0000-4000-8000-000000000001', operator: '20000000-0000-4000-8000-000000000002', viewer: '20000000-0000-4000-8000-000000000003', sub: '30000000-0000-4000-8000-000000000001', record: '40000000-0000-4000-8000-000000000001' };
const manifestPath = path.resolve(root, '../backups/expiry-isolated-fixture.json');
const results = [];
function check(value, name) { assert.ok(value, name); results.push(name); }
const copy = value => JSON.parse(JSON.stringify(value));
async function execute(settings = {}, prior) {
  const m = prior?.manifest || { organizationId: ids.org, companyName: 'FELEXIA RECETTE ESSENTIELLE ISOLATED', run: 'essential-final-isolated', authorizedMailbox: 'mailbox@example.test', users: Object.fromEntries(['admin', 'operator', 'viewer'].map(role => [role, { id: ids[role], email: 'mailbox+recette123' + role + '@example.test', password: 'Fixture-password-' + role }])), records: Object.fromEntries(['customerId', 'supplierId', 'saleId', 'purchaseId'].map(key => [key, ids.record])) };
  const original = prior?.original || { id: ids.sub, organization_id: ids.org, plan_code: 'essentiel', status: 'trialing', trial_start: new Date(Date.now() - 1000).toISOString(), trial_end: new Date(Date.now() + 86400000).toISOString(), trial_ends_at: new Date(Date.now() + 86400000).toISOString(), current_period_end: null, stripe_subscription_id: null, stripe_customer_id: null, updated_at: new Date(Date.now() - 1000).toISOString() };
  let subscription = copy(prior?.subscription || original);
  const files = new Map([[manifestPath, JSON.stringify(m)]]);
  const writes = [];
  const simulated = () => Date.parse(subscription.trial_end) < Date.now();
  let failExpiredResponse = settings.failExpiredResponse;
  let failedRestoreAttempts = 0;
  const client = (service = false) => {
    const db = { role: null, auth: { async signInWithPassword(input) { const [role, account] = Object.entries(m.users).find(([, account]) => account.email === input.email); db.role = role; return { data: { user: { id: account.id, email: account.email } }, error: settings.authFailure ? { code: 'invalid_credentials' } : null }; } },
      async rpc(name, input) { assert.equal(name, 'get_commercial_document_usage'); assert.equal(input.p_organization_id, ids.org); return { data: 2, error: null }; },
      from(table) {
        let patch = null, inserted = false, head = false, single = false;
        const filters = [];
        const evaluate = () => {
          if (patch) {
            assert.equal(service, true, 'Only service may set the subscription fixture');
            assert.equal(table, 'organization_subscriptions');
            assert.deepEqual(Object.keys(patch).sort(), ['trial_end', 'trial_ends_at']);
            assert.ok(filters.some(([key, value]) => key === 'id' && value === ids.sub));
            assert.ok(filters.some(([key, value]) => key === 'organization_id' && value === ids.org));
            writes.push(copy(patch));
            const restoring = Date.parse(patch.trial_end) > Date.now();
            if (restoring && (settings.failAllRestores || settings.failFirstRestore && failedRestoreAttempts++ === 0)) return { data: null, error: { code: 'fixture_restore_failure' } };
            subscription = { ...subscription, ...patch, updated_at: new Date().toISOString() };
            if (!restoring && failExpiredResponse) { failExpiredResponse = false; return { data: null, error: { code: 'fixture_lost_response' } }; }
            return { data: [copy(subscription)], error: null };
          }
          if (inserted) return { data: null, error: { code: '42501', message: 'SUBSCRIPTION_WRITE_REQUIRED' } };
          if (table === 'organization_subscriptions') return { data: [copy(subscription)], error: null };
          if (table === 'organizations') return { data: { id: ids.org, name: settings.foreignCompany ? 'Existing client company' : m.companyName, created_at: new Date().toISOString(), stripe_customer_id: settings.paidCompany ? 'cus_existing' : null }, error: null };
          if (table === 'organization_members') return { data: Object.values(m.users).map(account => ({ user_id: account.id })).concat(settings.fourthMember ? [{ user_id: ids.record }] : []), error: null };
          if (head) return { data: null, count: 1, error: null };
          throw new Error('Unexpected synthetic table: ' + table + single);
        };
        const query = { select(_fields, options) { head = Boolean(options?.head); return query; }, eq(key, value) { filters.push([key, value]); return query; }, is(key, value) { filters.push([key, value]); return query; }, order() { return query; }, limit() { return query; }, single() { single = true; return Promise.resolve(evaluate()); }, update(value) { patch = value; return query; }, insert() { inserted = true; return query; }, then(yes, no) { return Promise.resolve(evaluate()).then(yes, no); } };
        return query;
      },
    };
    return db;
  };
  const workspace = getClient => ({ userId: ids[getClient().role], organization: { id: ids.org, name: m.companyName }, role: getClient().role, subscription: { planCode: 'essentiel', status: 'trialing', trialEndsAt: subscription.trial_end, currentPeriodEnd: null } });
  const runner = getClient => ({
    load(file) {
      if (file === 'src/lib/auth.ts') return { getActiveWorkspace: async () => workspace(getClient) };
      if (file === 'src/lib/subscriptions/subscription-access.ts') return { canWriteWorkspaceSubscription: sub => Date.parse(sub.trialEndsAt) > Date.now() };
      if (file === 'src/lib/saas.ts') return { getUserOnboardingStatus: async () => ({ hasOrganization: true, hasValidSubscription: !simulated(), nextPath: '/dashboard' }) };
      if (file === 'src/lib/auth/require-subscription.ts') return { requireActiveSubscription: async () => workspace(getClient) };
      if (file === 'src/lib/invoices.ts') return { listCustomerInvoices: async () => { if (settings.readFailure) throw new Error('Synthetic read outage'); return { total: 1 }; } };
      if (file === 'src/lib/purchases.ts') return { listSupplierInvoices: async () => ({ total: 1 }) };
      if (file === 'src/lib/accounting.ts') return { listAccountingJournalsWithStats: async () => [{ id: ids.record, entries_count: 1 }], listAccountingJournalExportRows: async () => ({ entries: [{}] }) };
      if (file === 'src/app/api/exports/[kind]/route.ts') return { GET: async () => new Response('Header\nFixture\n', { headers: { 'content-type': 'text/csv' } }) };
      throw new Error('Unexpected source module: ' + file);
    },
    async invoke() { return { result: { success: false, error: 'Votre espace est en consultation.' } }; },
  });
  const fakeProcess = { argv: ['node', filename, '--manifest=' + manifestPath, '--execute-qa', ...(settings.restoreOnly ? ['--restore-only'] : [])], env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key', SUPABASE_SERVICE_ROLE_KEY: 'e30.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.fixture-signature' } };
  const moduleState = { exports: {} };
  vm.runInNewContext(source, { module: moduleState, process: fakeProcess, __dirname: path.join(root, 'scripts'), Buffer, Request, Response, URL, console: { log() {} }, require(name) {
    if (name === 'node:fs') return { realpathSync: value => value, readFileSync: value => files.get(value), mkdirSync() {}, writeFileSync: (value, contents) => files.set(value, contents) };
    if (name === '@next/env') return { loadEnvConfig() {} };
    if (name === '@supabase/supabase-js') return { createClient: (_url, key) => client(key !== 'fixture-public-key') };
    if (name === './essential-action-runner.cjs') return { createActionRunner: runner };
    return require(name);
  } }, { filename });
  await moduleState.exports;
  const reportFile = path.join(root, 'training/essential-fixes/20261031', settings.restoreOnly ? 'company-expiry-restoration.json' : 'company-expiry.json');
  return { report: JSON.parse(files.get(reportFile)), manifest: JSON.parse(files.get(manifestPath)), subscription, original, writes };
}
async function main() {
  let result = await execute();
  check(result.report.success && result.report.restored, 'Successful simulated expiry restores the QA trial');
  check(result.writes.length === 2 && result.subscription.trial_end === result.original.trial_end && result.subscription.trial_ends_at === result.original.trial_ends_at, 'Only two scoped fixture writes occur and restore the exact timestamps');
  check(!JSON.stringify(result.report).includes('Fixture-password'), 'Public report never contains private passwords or the subscription snapshot');
  result = await execute({ readFailure: true });
  check(!result.report.success && result.report.restored && !result.manifest.expiryState.restoreRequired, 'A business-read exception still executes exact restoration');
  result = await execute({ failExpiredResponse: true });
  check(!result.report.success && result.report.restored, 'Lost expiry-update response still triggers restoration');
  result = await execute({ failFirstRestore: true });
  check(result.report.success && result.report.restored && result.writes.length === 3, 'Transient restoration failure retries without changing the scoped target');
  const pending = await execute({ failAllRestores: true });
  check(!pending.report.success && pending.report.restorationPending && pending.manifest.expiryState.restoreRequired, 'Persistent restore failure retains the private original snapshot and marks the report failed');
  result = await execute({ restoreOnly: true }, pending);
  check(result.report.success && result.report.restored && !result.manifest.expiryState.restoreRequired, 'Restore-only mode safely recovers an interrupted pending fixture');
  for (const setting of ['foreignCompany', 'paidCompany', 'fourthMember', 'authFailure']) {
    result = await execute({ [setting]: true });
    check(!result.report.success && result.writes.length === 0, setting + ' is rejected before any subscription mutation');
  }
  fs.writeFileSync(path.join(__dirname, 'expiry-harness-tests.json'), JSON.stringify({ success: true, checks: results.length, scope: 'Real harness; isolated SDK/filesystem/Auth fixtures; zero network or project data', results }, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, checks: results.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
