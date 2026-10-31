/* eslint-disable @typescript-eslint/no-require-imports -- Explicitly authorized Node recette entry point. */
// NEVER use a customer company. Only the new, unpaid three-user recette trial
// may have its two trial-end fields temporarily changed by the service client.
// Every business action/read/export uses the three real public Auth sessions.
// The original subscription snapshot and credentials remain outside Git.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const argument = process.argv.find(value => value.startsWith('--manifest='))?.slice(11);
if (!argument || !process.argv.includes('--execute-qa')) throw new Error('Explicit private manifest and --execute-qa required');
const manifestPath = fs.realpathSync(path.resolve(argument));
const privateRoot = fs.realpathSync(path.resolve(root, '../backups')) + path.sep;
if (!manifestPath.toLowerCase().startsWith(privateRoot.toLowerCase())) throw new Error('The manifest must remain in the private backups folder outside Git');
const restoreOnly = process.argv.includes('--restore-only');
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!m.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !m.run?.startsWith('essential-final-') || !uuid.test(m.organizationId || '')) throw new Error('The dedicated new recette company markers are required');
if (typeof m.authorizedMailbox !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(m.authorizedMailbox)) throw new Error('Record the authorized test mailbox privately');
const [mailboxName, mailboxDomain] = m.authorizedMailbox.toLowerCase().split('@');
for (const role of ['admin', 'operator', 'viewer']) {
  const account = m.users?.[role];
  const email = (account?.email || '').toLowerCase();
  const prefix = mailboxName + '+recette';
  const suffix = role + '@' + mailboxDomain;
  if (!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length, -suffix.length)) || !uuid.test(account?.id || '') || !account.password) throw new Error('Only the prepared three authorized recette accounts may be used');
}
for (const field of ['customerId', 'supplierId', 'saleId', 'purchaseId']) if (!uuid.test(m.records?.[field] || '')) throw new Error('Complete business setup before expiry verification');
require('@next/env').loadEnvConfig(root);
const { createClient } = require('@supabase/supabase-js');
const { createActionRunner } = require('./essential-action-runner.cjs');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
function jwtRole(key) { try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { return null; } }
if (!url || !publicKey || publicKey.startsWith('sb_secret_') || publicKey.split('.').length === 3 && jwtRole(publicKey) !== 'anon') throw new Error('Public Supabase key required for business verification');
if (!serviceKey || !(serviceKey.startsWith('sb_secret_') || jwtRole(serviceKey) === 'service_role')) throw new Error('A real server key is required only for the scoped QA subscription fixture');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(url, serviceKey, options);
const clients = {};
let actor = 'admin';
const report = {
  date: new Date().toISOString(), run: m.run, companyName: m.companyName,
  phase: restoreOnly ? 'expiry-restore-only' : 'expiry', success: false, restored: false, checks: [], diagnostics: [],
  scope: { subscriptionState: 'Temporary server fixture on this new unpaid QA company only', business: 'Real server functions, exports and PostgreSQL/RLS using three public Auth sessions', framework: 'Next navigation/cache boundaries supplied by runner', payments: 'No Stripe event, checkout, payment or email' },
};
const runner = createActionRunner(() => clients[actor], report.diagnostics);
const directory = path.join(root, 'training/essential-fixes/20261031');
fs.mkdirSync(directory, { recursive: true });
function savePrivate() { fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n'); }
function check(name, passed) { report.checks.push({ name, passed: Boolean(passed) }); if (!passed) throw new Error('QA_CHECK_FAILED: ' + name); }
function redact(value) {
  let result = String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
  for (const account of Object.values(m.users)) if (account.password) result = result.split(account.password).join('[private]');
  return result.replace(/([?&](?:code|token_hash|token|access_token|refresh_token)=)[^\s&]+/gi, '$1[private]').slice(0, 250);
}
const trialFields = ['trial_end', 'trial_ends_at'];
const businessSnapshot = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at').sort(([a], [b]) => a.localeCompare(b)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function read(query, name) { const result = await query; check(name, !result.error && result.data !== null); return result.data; }
async function subscription() { return read(service.from('organization_subscriptions').select('*').eq('organization_id', m.organizationId).order('created_at', { ascending: false }).limit(2), 'Scoped server subscription read'); }
async function verifyCompanyScope() {
  const organization = await read(service.from('organizations').select('id,name,created_at,stripe_customer_id').eq('id', m.organizationId).single(), 'Scoped QA company exists');
  check('Server fixture targets the exact manifest company name and identifier', organization.id === m.organizationId && organization.name === m.companyName && !organization.stripe_customer_id);
  if (!restoreOnly) check('Company was newly created for this recette', Number.isFinite(Date.parse(organization.created_at)) && Date.parse(organization.created_at) <= Date.now() + 60000 && Date.now() - Date.parse(organization.created_at) < 48 * 3600000);
  return organization;
}
async function login(role) {
  actor = role;
  const client = createClient(url, publicKey, options);
  const signed = await client.auth.signInWithPassword({ email: m.users[role].email, password: m.users[role].password });
  check(role + ' authenticates through public Auth as the exact QA account', !signed.error && signed.data.user?.id === m.users[role].id && signed.data.user?.email?.toLowerCase() === m.users[role].email.toLowerCase());
  clients[role] = client;
  return workspace(role);
}
async function workspace(role) {
  actor = role;
  const current = await runner.load('src/lib/auth.ts').getActiveWorkspace();
  check(role + ' retains the dedicated company and role', current?.organization.id === m.organizationId && current.organization.name === m.companyName && (current.role === role || role === 'admin' && current.role === 'owner'));
  return current;
}
async function captureCounts() {
  const result = {};
  for (const table of ['customer_invoices', 'supplier_invoices', 'customer_payments', 'supplier_payments', 'accounting_entries', 'treasury_transactions']) {
    const response = await clients.admin.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', m.organizationId);
    check(table + ' QA count can be read with public administrator session', !response.error && Number.isInteger(response.count));
    result[table] = response.count;
  }
  const usage = await clients.admin.rpc('get_commercial_document_usage', { p_organization_id: m.organizationId });
  check('Real commercial usage can be read with public administrator session', !usage.error && Number.isFinite(Number(usage.data)));
  result.commercialUsage = Number(usage.data);
  return result;
}
function snapshotMatchesManifest(state) {
  return state?.run === m.run && state.organizationId === m.organizationId && uuid.test(state.subscriptionId || '') && state.original?.id === state.subscriptionId && state.original.organization_id === m.organizationId && ['trial', 'trialing'].includes(state.original.status) && state.original.plan_code === 'essentiel' && !state.original.stripe_subscription_id && !state.original.stripe_customer_id;
}
async function restore() {
  const state = m.expiryState;
  if (!state?.restoreRequired) return;
  if (!snapshotMatchesManifest(state)) throw new Error('EXPIRY_RESTORE_SCOPE_MISMATCH');
  await verifyCompanyScope();
  const original = state.original;
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await subscription();
    if (rows.length !== 1 || rows[0].id !== state.subscriptionId) throw new Error('EXPIRY_RESTORE_SUBSCRIPTION_ID_MISMATCH');
    const current = rows[0];
    if (current.stripe_subscription_id || current.stripe_customer_id || current.status !== original.status || current.plan_code !== original.plan_code) throw new Error('EXPIRY_RESTORE_EXTERNAL_BILLING_CONFLICT');
    if (trialFields.every(key => current[key] === original[key])) {
      state.restoreRequired = false; state.restoredAt = new Date().toISOString(); savePrivate();
      report.restored = true;
      check('Original trial-end columns are restored exactly', true);
      return;
    }
    const patch = Object.fromEntries(trialFields.map(key => [key, original[key]]));
    let query = service.from('organization_subscriptions').update(patch).eq('id', state.subscriptionId).eq('organization_id', m.organizationId).eq('status', original.status).eq('plan_code', original.plan_code).is('stripe_subscription_id', null).is('stripe_customer_id', null);
    if (current.updated_at) query = query.eq('updated_at', current.updated_at);
    const updated = await query.select('*');
    if (updated.error || updated.data?.length !== 1) continue;
    if (!trialFields.every(key => updated.data[0][key] === original[key])) continue;
    state.restoreRequired = false; state.restoredAt = new Date().toISOString(); savePrivate();
    report.restored = true;
    check('Original trial-end columns are restored exactly', true);
    return;
  }
  throw new Error('EXPIRY_RESTORE_FAILED_PRIVATE_SNAPSHOT_RETAINED');
}
async function verifyExpiredRole(role) {
  const current = await workspace(role);
  check(role + ' sees the expired trial as non-writable', !runner.load('src/lib/subscriptions/subscription-access.ts').canWriteWorkspaceSubscription(current.subscription));
  const onboarding = await runner.load('src/lib/saas.ts').getUserOnboardingStatus();
  check(role + ' page loader preserves company consultation without an invented trial', onboarding.hasOrganization && !onboarding.hasValidSubscription && onboarding.nextPath.startsWith('/dashboard'));
  const consulted = await runner.load('src/lib/auth/require-subscription.ts').requireActiveSubscription();
  check(role + ' consultation guard keeps the same company', consulted.organization.id === m.organizationId);
  const sales = await runner.load('src/lib/invoices.ts').listCustomerInvoices({ page: 1 });
  const purchases = await runner.load('src/lib/purchases.ts').listSupplierInvoices({ page: 1 });
  check(role + ' can still read real sales and purchases', sales.total > 0 && purchases.total > 0);
  const journalRows = await runner.load('src/lib/accounting.ts').listAccountingJournalsWithStats();
  check(role + ' can still read journals', journalRows.length > 0);
  const journal = journalRows.find(row => row.entries_count > 0);
  check(role + ' has posted journal history available', Boolean(journal));
  const journalExport = await runner.load('src/lib/accounting.ts').listAccountingJournalExportRows(journal.id);
  check(role + ' journal export retains its entries', journalExport.entries.length === journal.entries_count && journalExport.entries.length > 0);
  const handler = runner.load('src/app/api/exports/[kind]/route.ts');
  for (const kind of ['sales', 'purchases', 'contacts', 'treasury', 'treasury-ledger', 'supplier-credits']) {
    const response = await handler.GET(new Request('https://www.felexia.pro/api/exports/' + kind), { params: Promise.resolve({ kind }) });
    check(role + ' ' + kind + ' export remains available after expiry', response.status === 200 && response.headers.get('content-type')?.includes('text/csv') && (await response.text()).length > 0);
  }
  const result = await runner.invoke('src/lib/invoice-actions.ts', 'createCustomerInvoice', {
    customer_id: m.records.customerId, invoice_date: new Date().toISOString().slice(0, 10), source_type: 'manual',
    notes: 'QA expiry: this document must never be created',
    lines: [{ id: crypto.randomUUID(), mode: 'free', description: 'QA expiry denied invoice', quantity: 1, unit_price_ht: 1, discount_rate: 0, tax_rate: 20 }],
  });
  check(role + ' real invoice action is refused after expiry', !result.redirect && result.result?.success === false && /consultation|profil|modification|autoris/i.test(result.result?.error || ''));
  const raw = await clients[role].from('customer_invoices').insert({ organization_id: m.organizationId, customer_id: m.records.customerId, invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), currency: 'MAD', status: 'draft', notes: 'QA expiry: raw insertion must never succeed' }).select('id');
  check(role + ' raw public database insertion is refused', Boolean(raw.error && raw.error.code === '42501' && (role === 'viewer' || raw.error.message.includes('SUBSCRIPTION_WRITE_REQUIRED'))));
}
async function main() {
  await verifyCompanyScope();
  if (restoreOnly) {
    check('A pending private QA restoration snapshot exists', snapshotMatchesManifest(m.expiryState) && m.expiryState.restoreRequired);
    await restore(); report.success = report.restored; return;
  }
  if (m.expiryState?.restoreRequired) throw new Error('EXPIRY_RESTORE_PENDING_USE_RESTORE_ONLY');
  for (const role of ['admin', 'operator', 'viewer']) {
    const current = await login(role);
    check(role + ' starts with the real active Essentiel trial', current.subscription?.planCode === 'essentiel' && current.subscription.status === 'trialing' && runner.load('src/lib/subscriptions/subscription-access.ts').canWriteWorkspaceSubscription(current.subscription));
  }
  const members = await read(clients.admin.from('organization_members').select('user_id').eq('organization_id', m.organizationId).eq('status', 'active'), 'QA membership is readable');
  check('Only the exact three prepared users belong to the company', members.length === 3 && members.every(member => Object.values(m.users).some(account => account.id === member.user_id)));
  const originalRows = await subscription();
  check('Only one unpaid Essentiel trial will be simulated', originalRows.length === 1 && originalRows[0].plan_code === 'essentiel' && originalRows[0].status === 'trialing' && !originalRows[0].stripe_subscription_id && !originalRows[0].stripe_customer_id);
  const original = originalRows[0];
  const counts = await captureCounts();
  const state = m.expiryState = { run: m.run, organizationId: m.organizationId, subscriptionId: original.id, original, simulatedEnd: new Date(Date.now() - 86400000).toISOString(), startedAt: new Date().toISOString(), restoreRequired: true };
  savePrivate();
  try {
    let query = service.from('organization_subscriptions').update({ trial_end: state.simulatedEnd, trial_ends_at: state.simulatedEnd }).eq('id', original.id).eq('organization_id', m.organizationId).eq('status', 'trialing').eq('plan_code', 'essentiel').is('stripe_subscription_id', null).is('stripe_customer_id', null);
    if (original.updated_at) query = query.eq('updated_at', original.updated_at);
    const expired = await read(query.select('*'), 'Temporary QA subscription fixture is applied');
    check('Exactly the intended subscription was temporarily expired', expired.length === 1 && expired[0].id === original.id && trialFields.every(key => Date.parse(expired[0][key]) < Date.now()));
    const expectedExpired = businessSnapshot(expired[0]);
    for (const role of ['admin', 'operator', 'viewer']) await verifyExpiredRole(role);
    const after = await subscription();
    check('GET loaders and rejected writes never extend or bootstrap the subscription', after.length === 1 && same(businessSnapshot(after[0]), expectedExpired));
    check('Rejected operations preserve document, payment, treasury, journal and quota counts', same(await captureCounts(), counts));
  } finally { await restore(); }
  const restoredRows = await subscription();
  check('Every subscription business field matches its original snapshot', restoredRows.length === 1 && same(businessSnapshot(restoredRows[0]), businessSnapshot(original)));
  for (const role of ['admin', 'operator', 'viewer']) {
    const current = await workspace(role);
    check(role + ' regains the original usable trial after exact restoration', runner.load('src/lib/subscriptions/subscription-access.ts').canWriteWorkspaceSubscription(current.subscription));
  }
  report.auditUpdatedAtMayAdvance = true;
  report.success = true;
}
main().catch(error => {
  report.success = false;
  report.failure = /^(?:QA_CHECK_FAILED:|EXPIRY_)/.test(error?.message || '') ? redact(error.message) : 'EXPIRY_VERIFICATION_FAILED';
  report.restorationPending = Boolean(m.expiryState?.restoreRequired);
  process.exitCode = 1;
}).finally(() => {
  report.diagnostics = report.diagnostics.map(redact);
  report.completedAt = new Date().toISOString();
  savePrivate();
  fs.writeFileSync(path.join(directory, restoreOnly ? 'company-expiry-restoration.json' : 'company-expiry.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, passed: report.checks.filter(item => item.passed).length, restored: report.restored, restorationPending: report.restorationPending, failure: report.failure }));
});
