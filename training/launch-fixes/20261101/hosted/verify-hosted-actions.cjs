/* eslint-disable @typescript-eslint/no-require-imports -- Deliberately gated, narrowly scoped hosted QA. */
// Default: local plan only, no env load, auth or network. No Stripe/mail/DGI/cron code.
// Execution requires explicit SQL confirmation and permission for temporary QA PRO.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const EXPECTED_ORG = '1eabead7-02ca-4d44-b147-2831d8799eaa';
const EXPECTED_RUN = 'essential-final-20261031202921';
const EXPECTED_COMPANY = 'FELEXIA RECETTE ESSENTIELLE 20261031202921';
const MARKER = 'felexia-qa-hosted-actions-20261101';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const execute = process.argv.includes('--execute-qa-actions');
const checkInstalled = process.argv.includes('--check-installed');
const readOnly = process.argv.includes('--read-only') || checkInstalled;
if (execute && readOnly) throw Error('Choose read-only or execute mode');
if (execute && (!process.argv.includes('--confirm-sql-105-107') || !process.argv.includes('--allow-temporary-qa-pro'))) throw Error('Execution requires --confirm-sql-105-107 and --allow-temporary-qa-pro');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
}
const digest = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const businessContract = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at'));
function privatePath(filename, existing = false) {
  const directory = fs.realpathSync(path.resolve(root, '../backups'));
  const absolute = path.resolve(filename);
  const target = existing ? fs.realpathSync(absolute) : path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute));
  const relative = path.relative(directory, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('PRIVATE_BACKUP_PATH_REQUIRED');
  return target;
}
function verifyManifest(manifest) {
  if (manifest.organizationId !== EXPECTED_ORG || manifest.run !== EXPECTED_RUN || manifest.companyName !== EXPECTED_COMPANY) throw Error('QA_MANIFEST_SCOPE_MISMATCH');
  const [mailbox, domain] = String(manifest.authorizedMailbox ?? '').toLowerCase().split('@');
  if (!mailbox || !domain) throw Error('QA_AUTHORIZED_MAILBOX_REQUIRED');
  for (const role of ['admin', 'operator', 'viewer']) {
    const user = manifest.users?.[role];
    const email = String(user?.email ?? '').toLowerCase();
    const prefix = mailbox + '+recette'; const suffix = role + '@' + domain;
    if (!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length, -suffix.length)) || !uuid.test(user?.id ?? '') || !user?.password) throw Error('QA_ACTOR_SCOPE_MISMATCH');
  }
  for (const key of ['customerId', 'supplierId', 'bankId']) if (!uuid.test(manifest.records?.[key] ?? '')) throw Error('QA_EXISTING_REFERENCE_REQUIRED');
}
const manifestPath = privatePath(arg('manifest') ?? path.resolve(root, '../backups/essential-fixes-e2e-private.json'), true);
let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
catch { throw Error('QA_PRIVATE_MANIFEST_UNAVAILABLE_OR_INVALID'); }
verifyManifest(manifest);

const plan = {
  mode: 'plan-only', target: 'Exact existing synthetic QA company and its three authorized aliases, checked privately',
  authenticatedSdk: 'Actual TS server actions through essential-action-runner; only Next request/cache/navigation boundaries supplied',
  requiredFlags: ['--execute-qa-actions', '--confirm-sql-105-107', '--allow-temporary-qa-pro'],
  scenarios: ['Create/edit quote with current version and reject stale edit', 'Convert quote twice to the same order', 'Create/edit supplier order with current version and reject stale edit', 'Operator/viewer refuse commercial saves and conversion', 'Missing treasury target refuses through action and RPC while the existing bank stays identical', 'If payroll settings are already incomplete, create one disposable period and reject base-only preparation without a payslip'],
  temporaryContractFields: ['plan_code', 'plan_id'], expiryChanged: false,
  restoration: 'Private full baseline before changes; compare-and-swap plan restore; all original business contract fields verified except monotone updated_at audit timestamp',
  cleanup: 'Only IDs created by this run in exact QA, exact marker/creator, verified against private baseline. No existing row is deleted.',
  expectedAuditChanges: ['QA document sequence counters', 'QA numbering issuance/deletion ledger', 'QA subscription updated_at audit timestamp'],
  prohibited: ['Stripe Checkout or payment', 'Email/invitation/recovery', 'DGI transmission', 'Cron execution', 'Changing payroll settings', 'Extending any expiry', 'Other company writes'],
  limitation: 'No browser forms or multi-connection concurrency are certified. Auth session timestamps can advance. Read-only mode never upgrades QA.'
};
if (!execute && !readOnly) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }

require('@next/env').loadEnvConfig(root, false, { info() {}, error() {} });
const { createClient } = require('@supabase/supabase-js');
const { createActionRunner } = require(path.join(root, 'scripts/essential-action-runner.cjs'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || (!checkInstalled && !serviceKey) || publicKey === serviceKey || publicKey.startsWith('sb_secret_')) throw Error('QA_PUBLIC_AUTH_AND_PRIVATE_FIXTURE_CONFIG_REQUIRED');
const originalFetch = globalThis.fetch;
const projectOrigin = new URL(url).origin;
globalThis.fetch = async (input, init = {}) => {
  const target = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  const method = String(init.method ?? input?.method ?? 'GET').toUpperCase();
  const authPathAllowed = ['/auth/v1/token', '/auth/v1/user', '/auth/v1/logout'].includes(target.pathname);
  const restPathAllowed = target.pathname.startsWith('/rest/v1/');
  if (target.origin !== projectOrigin || (!authPathAllowed && !restPathAllowed)) throw Error('QA_EXTERNAL_OR_UNREQUESTED_NETWORK_BLOCKED');
  if (readOnly && restPathAllowed && !['GET', 'HEAD'].includes(method) && !(method === 'POST' && target.pathname === '/rest/v1/rpc/pro_transaction_capabilities')) throw Error('QA_READ_ONLY_MUTATION_BLOCKED');
  return originalFetch(input, init);
};
const service = checkInstalled ? null : createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const clients = {}; let actor = 'admin';
const diagnostics = [];
const runner = createActionRunner(() => clients[actor], diagnostics);
const report = { at: new Date().toISOString(), mode: execute ? 'execute-qa-actions' : checkInstalled ? 'check-installed' : 'read-only', target: 'Exact guarded synthetic QA only', passed: false, checks: [], limitations: [], restored: false, cleanupComplete: false, emailsPaymentsDgiCron: 0, subscriptionExpiryChanged: false };
const output = path.join(__dirname, checkInstalled ? 'installed-status.json' : readOnly ? 'read-only.json' : 'hosted-actions.json');
function check(name, passed) { report.checks.push({ name, passed: Boolean(passed) }); if (!passed) throw Error('QA_CHECK_FAILED_' + name.replace(/[^a-z0-9]+/gi, '_')); }
function saveReport() { fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
async function rows(table, client = service) {
  const result = [];
  for (;;) {
    let query = client.from(table).select('*').eq('organization_id', EXPECTED_ORG);
    query = table === 'stock_levels' ? query.order('warehouse_id').order('product_id')
      : table === 'commercial_document_usage' ? query.order('document_table').order('document_id') : query.order('id');
    const response = await query.range(result.length, result.length + 499);
    if (response.error) throw Error('QA_SCOPED_READ_FAILED_' + table);
    if (response.data.some(row => row.organization_id !== EXPECTED_ORG)) throw Error('QA_TENANT_DRIFT');
    if (response.data.length === 0) return result;
    result.push(...response.data);
  }
}
const financialTables = ['customer_invoices', 'customer_invoice_lines', 'supplier_invoices', 'supplier_invoice_lines', 'customer_credit_notes', 'customer_credit_note_lines', 'customer_credit_note_applications', 'supplier_credit_notes', 'supplier_credit_note_lines', 'supplier_credit_note_applications', 'customer_payments', 'customer_payment_allocations', 'supplier_payments', 'supplier_payment_allocations', 'treasury_accounts', 'treasury_transactions', 'accounting_entries', 'accounting_entry_lines', 'stock_moves', 'stock_levels', 'bank_statement_imports', 'bank_statement_lines'];
const controlledTables = ['sales_documents', 'sales_document_lines', 'purchase_documents', 'purchase_document_lines', 'hr_payroll_periods', 'hr_payslips', 'hr_settings', 'hr_employees', 'hr_contracts', 'third_parties', 'units', 'tax_rates', 'products', 'organization_modules'];
const auditTables = ['numbering_sequences', 'numbering_number_issues', 'numbering_counter_changes', 'commercial_document_usage'];
async function snapshot(tables) { const result = {}; for (const table of tables) result[table] = await rows(table); return result; }
const fingerprints = snapshot => Object.fromEntries(Object.entries(snapshot).map(([table, data]) => [table, { count: data.length, sha256: digest(data) }]));
async function readSubscription() {
  const response = await service.from('organization_subscriptions').select('*').eq('organization_id', EXPECTED_ORG).limit(2);
  if (response.error || response.data?.length !== 1) throw Error('QA_UNIQUE_SUBSCRIPTION_REQUIRED');
  return response.data[0];
}
function cas(query, row) { for (const key of ['id', 'organization_id', 'plan_code', 'plan_id', 'updated_at']) query = row[key] == null ? query.is(key, null) : query.eq(key, row[key]); return query; }
async function login(role) {
  actor = role;
  if (!clients[role]) {
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const signed = await client.auth.signInWithPassword({ email: manifest.users[role].email, password: manifest.users[role].password });
    check(role + ' public Auth exact identity', !signed.error && signed.data.user?.id === manifest.users[role].id && signed.data.user?.email?.toLowerCase() === manifest.users[role].email.toLowerCase());
    clients[role] = client;
    const memberships = await client.from('organization_members').select('organization_id,role:roles(name)').eq('user_id', signed.data.user.id).eq('status', 'active');
    const membership = memberships.data?.[0]; const actual = Array.isArray(membership?.role) ? membership.role[0]?.name : membership?.role?.name;
    check(role + ' unique membership and role', !memberships.error && memberships.data?.length === 1 && membership.organization_id === EXPECTED_ORG && (role === 'admin' ? ['owner', 'admin'].includes(actual) : actual === role));
  }
  const workspace = await runner.load('src/lib/auth.ts').getActiveWorkspace();
  check(role + ' action workspace exact QA', workspace?.organization.id === EXPECTED_ORG && workspace?.organization.name === EXPECTED_COMPANY);
  return clients[role];
}
async function invoke(file, name, payload, expected = 'success') {
  let response;
  try { response = await runner.invoke(file, name, payload); }
  catch (error) {
    if (expected !== 'denied') throw error;
    response = { denied: true, denialMessage: error.message };
  }
  const success = Boolean(response.redirect && /^\/(?:vente|achats)\//.test(response.redirect)) || Boolean(response.result?.success);
  check(name + ' ' + actor + ' ' + expected, expected === 'denied' ? !success : success);
  if (expected === 'denied') {
    const reason = String(response.result?.error ?? response.denialMessage ?? '');
    const recognized = actor !== 'admin' ? /rôle ne permet pas|lecture seule|droits nécessaires|profil.*offre/i.test(reason)
      : name === 'setDefaultTreasuryAccount' ? /introuvable|non trouv|n.existe pas/i.test(reason)
        : /document a changé depuis son ouverture/i.test(reason);
    check(name + ' refusal has expected business reason', recognized);
  }
  return response;
}
const idFrom = response => response.redirect?.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
async function record(table, id) {
  const response = await service.from(table).select('*').eq('organization_id', EXPECTED_ORG).eq('id', id).single();
  if (response.error) throw Error('QA_CREATED_RECORD_UNAVAILABLE'); return response.data;
}
function settingsIncomplete(settings) {
  if (settings.length !== 1) return true;
  const s = settings[0];
  if (s.payroll_currency !== 'MAD' || [s.cnss_enabled, s.amo_enabled, s.ir_enabled].some(value => typeof value !== 'boolean')) return true;
  const goodRate = value => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 100;
  return (s.cnss_enabled && (!goodRate(s.cnss_employee_rate) || !goodRate(s.cnss_employer_rate) || !Number.isFinite(Number(s.cnss_monthly_ceiling)) || Number(s.cnss_monthly_ceiling) <= 0))
    || (s.amo_enabled && (!goodRate(s.amo_employee_rate) || !goodRate(s.amo_employer_rate)))
    || (s.ir_enabled && (!Array.isArray(s.ir_brackets) || s.ir_brackets.length === 0));
}

let recovery; let recoveryPath; let lock; let lockPath;
function saveRecovery() { fs.writeFileSync(recoveryPath, JSON.stringify(recovery, null, 2) + '\n', { mode: 0o600 }); }
async function register(table, id) {
  if (!uuid.test(id ?? '')) throw Error('QA_CREATED_ID_REQUIRED');
  const row = await record(table, id);
  if (recovery.beforeControlled[table].some(prior => prior.id === id) || row.created_by !== manifest.users.admin.id || Date.parse(row.created_at) < Date.parse(recovery.startedAt)) throw Error('QA_CREATED_ID_SCOPE_MISMATCH');
  if (table !== 'hr_payroll_periods' && !String(row.notes ?? '').startsWith(recovery.noteMarker)) throw Error('QA_CREATED_MARKER_REQUIRED');
  if (table === 'hr_payroll_periods' && (row.month !== recovery.payrollMonth || row.year !== recovery.payrollYear)) throw Error('QA_CREATED_PERIOD_SCOPE_MISMATCH');
  if (!recovery.created[table].includes(id)) { recovery.created[table].push(id); saveRecovery(); }
  return row;
}
async function discoverCreated() {
  // Exact per-run marker and creator allow recovery if an action redirected just before journaling its ID.
  for (const table of ['sales_documents', 'purchase_documents']) {
    const all = await rows(table);
    for (const row of all.filter(row => String(row.notes ?? '').startsWith(recovery.noteMarker) && row.created_by === manifest.users.admin.id && Date.parse(row.created_at) >= Date.parse(recovery.startedAt))) await register(table, row.id);
  }
  if (recovery.payrollMonth && recovery.payrollYear) for (const row of await rows('hr_payroll_periods')) {
    if (row.month === recovery.payrollMonth && row.year === recovery.payrollYear && row.created_by === manifest.users.admin.id && Date.parse(row.created_at) >= Date.parse(recovery.startedAt)) await register('hr_payroll_periods', row.id);
  }
}
async function cleanup() {
  await discoverCreated();
  for (const table of ['sales_documents', 'purchase_documents', 'hr_payroll_periods']) for (const id of recovery.created[table]) await register(table, id);
  for (const [header, lines] of [['sales_documents', 'sales_document_lines'], ['purchase_documents', 'purchase_document_lines']]) {
    const ids = recovery.created[header]; if (!ids.length) continue;
    const deleted = await service.from(lines).delete().eq('organization_id', EXPECTED_ORG).in('document_id', ids);
    if (deleted.error) throw Error('QA_OWN_LINE_CLEANUP_FAILED');
    if (header === 'sales_documents') {
      const cleared = await service.from(header).update({ related_order_id: null, source_document_id: null }).eq('organization_id', EXPECTED_ORG).in('id', ids);
      if (cleared.error) throw Error('QA_OWN_LINK_CLEANUP_FAILED');
    }
    const removed = await service.from(header).delete().eq('organization_id', EXPECTED_ORG).in('id', ids);
    if (removed.error) throw Error('QA_OWN_DOCUMENT_CLEANUP_FAILED');
    recovery.cleaned[header] = true; saveRecovery();
  }
  for (const id of recovery.created.hr_payroll_periods) {
    const slips = await service.from('hr_payslips').select('id', { head: true, count: 'exact' }).eq('organization_id', EXPECTED_ORG).eq('payroll_period_id', id);
    if (slips.error || slips.count !== 0) throw Error('QA_UNEXPECTED_PAYSLIP_MANUAL_REVIEW_REQUIRED');
    const removed = await service.from('hr_payroll_periods').delete().eq('organization_id', EXPECTED_ORG).eq('id', id);
    if (removed.error) throw Error('QA_OWN_PERIOD_CLEANUP_FAILED');
  }
  recovery.cleanupComplete = true; saveRecovery(); report.cleanupComplete = true;
}
async function restoreContract() {
  if (!recovery?.planUpdateAttempted) { report.restored = true; return; }
  const current = await readSubscription();
  const original = recovery.originalSubscription;
  if (digest(businessContract(current)) !== digest(businessContract(original))) {
    const expected = { ...original, plan_code: 'premium', plan_id: recovery.premiumPlanId };
    if (digest(businessContract(current)) !== digest(businessContract(expected))) throw Error('QA_RESTORE_CONTRACT_DRIFT_REQUIRES_REVIEW');
    const restored = await cas(service.from('organization_subscriptions').update({ plan_code: original.plan_code, plan_id: original.plan_id }), current).select('*');
    if (restored.error || restored.data?.length !== 1) throw Error('QA_RESTORE_CAS_FAILED');
  }
  const verified = await readSubscription();
  if (digest(businessContract(verified)) !== digest(businessContract(original))) throw Error('QA_RESTORE_VERIFICATION_FAILED');
  recovery.restorationRequired = false; recovery.restoredAt = new Date().toISOString(); saveRecovery(); report.restored = true;
}
async function capabilities() {
  const admin = await login('admin');
  const capability = await admin.rpc('pro_transaction_capabilities', { p_organization_id: EXPECTED_ORG });
  const ready = !capability.error && capability.data?.commercial_version === 105 && capability.data?.atomic_commercial === true && capability.data?.atomic_conversion === true && capability.data?.atomic_payroll === true;
  report.capabilities = { available: !capability.error, commercial105: ready, treasury107: 'Only tested by a deliberately missing target in execute mode' };
  if (execute) check('Hosted SQL105 and106 capability installed', ready);
  const company = await service.from('organizations').select('id,name').eq('id', EXPECTED_ORG).single();
  check('Private manifest matches hosted synthetic company', !company.error && company.data?.name === EXPECTED_COMPANY);
  for (const [table, id, type] of [['third_parties', manifest.records.customerId, 'customer'], ['third_parties', manifest.records.supplierId, 'supplier'], ['treasury_accounts', manifest.records.bankId, 'bank']]) {
    const value = await record(table, id);
    check('Existing QA reference ' + type, type === 'bank' ? value.currency === 'MAD' : Array.isArray(value.types) && value.types.includes(type) && value.status === 'active' && !value.archived_at);
  }
  return ready;
}
async function commercialActions() {
  const today = new Date().toISOString().slice(0, 10);
  const line = price => ({ id: randomUUID(), mode: 'free', description: 'Synthetic launch transaction only', quantity: 1, unit_price_ht: price, discount_rate: 0, tax_rate: 20 });
  const quoteForm = { customer_id: manifest.records.customerId, document_date: today, valid_until: today, notes: recovery.noteMarker + ':quote', payment_terms: 'cash', payment_method: 'bank_transfer', lines: [line(100)] };
  const supplierForm = { supplier_id: manifest.records.supplierId, document_date: today, expected_receipt_date: today, notes: recovery.noteMarker + ':supplier', lines: [line(50)] };
  await login('admin');
  const quoteId = idFrom(await invoke('src/lib/sales-actions.ts', 'createSalesQuote', quoteForm));
  const quote = await register('sales_documents', quoteId);
  check('Quote creation has expected draft and totals', quote.status === 'draft' && quote.document_type === 'quote' && Number(quote.total_ttc) === 120);
  await invoke('src/lib/sales-actions.ts', 'updateSalesQuote', { ...quoteForm, id: quoteId, expected_updated_at: quote.updated_at, lines: [line(200)] });
  const edited = await record('sales_documents', quoteId);
  check('Quote edit preserves number and advances version', edited.document_number === quote.document_number && edited.updated_at !== quote.updated_at && Number(edited.total_ttc) === 240);
  const beforeStale = digest({ header: edited, lines: (await rows('sales_document_lines')).filter(row => row.document_id === quoteId) });
  await invoke('src/lib/sales-actions.ts', 'updateSalesQuote', { ...quoteForm, id: quoteId, expected_updated_at: quote.updated_at }, 'denied');
  check('Stale quote edit preserves exact document and lines', beforeStale === digest({ header: await record('sales_documents', quoteId), lines: (await rows('sales_document_lines')).filter(row => row.document_id === quoteId) }));
  const orderId = idFrom(await invoke('src/lib/sales-actions.ts', 'convertQuoteToOrder', { id: quoteId }));
  const order = await register('sales_documents', orderId);
  const repeated = idFrom(await invoke('src/lib/sales-actions.ts', 'convertQuoteToOrder', { id: quoteId }));
  check('Quote conversion is idempotent with same amount', repeated === orderId && order.source_document_id === quoteId && Number(order.total_ttc) === 240);
  check('Quote conversion creates one order only', (await rows('sales_documents')).filter(row => row.source_document_id === quoteId && row.document_type === 'order').length === 1);
  const supplierId = idFrom(await invoke('src/lib/purchase-actions.ts', 'createSupplierOrder', supplierForm));
  const supplier = await register('purchase_documents', supplierId);
  await invoke('src/lib/purchase-actions.ts', 'updateSupplierOrder', { ...supplierForm, id: supplierId, expected_updated_at: supplier.updated_at, lines: [line(75)] });
  const editedSupplier = await record('purchase_documents', supplierId);
  check('Supplier order versioned edit preserves number and total90', editedSupplier.document_number === supplier.document_number && editedSupplier.updated_at !== supplier.updated_at && Number(editedSupplier.total_ttc) === 90);
  const supplierBeforeStale = digest({ header: editedSupplier, lines: (await rows('purchase_document_lines')).filter(row => row.document_id === supplierId) });
  await invoke('src/lib/purchase-actions.ts', 'updateSupplierOrder', { ...supplierForm, id: supplierId, expected_updated_at: supplier.updated_at }, 'denied');
  check('Stale supplier edit preserves exact header and lines', supplierBeforeStale === digest({ header: await record('purchase_documents', supplierId), lines: (await rows('purchase_document_lines')).filter(row => row.document_id === supplierId) }));
  for (const role of ['operator', 'viewer']) {
    await login(role);
    await invoke('src/lib/sales-actions.ts', 'createSalesQuote', quoteForm, 'denied');
    await invoke('src/lib/sales-actions.ts', 'updateSalesQuote', { ...quoteForm, id: quoteId, expected_updated_at: edited.updated_at }, 'denied');
    await invoke('src/lib/sales-actions.ts', 'convertQuoteToOrder', { id: quoteId }, 'denied');
    await invoke('src/lib/purchase-actions.ts', 'createSupplierOrder', supplierForm, 'denied');
    const direct = await clients[role].rpc('save_pro_commercial_document_atomic', { p_organization_id: EXPECTED_ORG, p_document_id: null, p_kind: 'quote', p_expected_updated_at: null, p_header: { customer_id: manifest.records.customerId }, p_lines: [line(100)] });
    check(role + ' direct commercial RPC denies before creation', Boolean(direct.error) && direct.error.code === '42501');
  }
  await login('admin');
}
async function missingTreasuryTarget() {
  const target = randomUUID();
  check('Random missing bank target absent', !(await rows('treasury_accounts')).some(row => row.id === target));
  const before = digest(await rows('treasury_accounts'));
  await invoke('src/lib/treasury-actions.ts', 'setDefaultTreasuryAccount', { id: target }, 'denied');
  const direct = await clients.admin.rpc('set_default_treasury_account_atomic', { p_organization_id: EXPECTED_ORG, p_account_id: target });
  check('107 missing target refuses via installed RPC', direct.error?.code === 'P0002');
  check('Missing target leaves all bank metadata and balances identical', before === digest(await rows('treasury_accounts')));
}
async function payrollMissingSettings() {
  if (!settingsIncomplete(recovery.beforeControlled.hr_settings)) { report.limitations.push('Payroll refusal case skipped because existing QA settings are configured. No settings are cleared or changed.'); return; }
  const periods = recovery.beforeControlled.hr_payroll_periods;
  let month = 12; const year = 2199;
  while (month > 0 && periods.some(row => row.month === month && row.year === year)) month--;
  if (month === 0) { report.limitations.push('No isolated unused QA payroll month in the bounded test year. Payroll refusal case skipped.'); return; }
  recovery.payrollMonth = month; recovery.payrollYear = year; saveRecovery();
  const form = new FormData(); form.set('month', String(month)); form.set('year', String(year));
  let periodId;
  try { await runner.load('src/lib/hr/actions.ts').createHrPayrollPeriodAction(form); }
  catch (error) { if (error instanceof runner.ActionRedirect) periodId = error.destination.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0]; else throw error; }
  const period = await register('hr_payroll_periods', periodId);
  const before = digest(period);
  const preparation = new FormData(); preparation.set('expected_updated_at', period.updated_at); preparation.set('ack_base_only', 'yes');
  let denied = false;
  try { await runner.load('src/lib/hr/actions.ts').calculateHrPayrollPeriodAction(periodId, preparation); } catch { denied = true; }
  check('Actual payroll action refuses incomplete existing settings', denied);
  const direct = await clients.admin.rpc('prepare_hr_payroll_atomic', { p_organization_id: EXPECTED_ORG, p_period_id: periodId, p_expected_updated_at: period.updated_at, p_ack_base_only: true });
  check('106 RPC identifies incomplete settings explicitly', Boolean(direct.error) && /PAYROLL_SETTINGS_REQUIRED/.test(direct.error.message));
  check('Failed payroll preparation leaves period and zero slips', before === digest(await record('hr_payroll_periods', periodId)) && !(await rows('hr_payslips')).some(row => row.payroll_period_id === periodId));
}

async function main() {
  let failure;
  try {
    if (checkInstalled) {
      const admin = await login('admin');
      const capability = await admin.rpc('pro_transaction_capabilities', { p_organization_id: EXPECTED_ORG });
      const session = await admin.auth.getSession();
      if (!session.data.session?.access_token) throw Error('QA_PUBLIC_SESSION_REQUIRED');
      const schema = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, { headers: { apikey: publicKey, Authorization: 'Bearer ' + session.data.session.access_token }, cache: 'no-store' });
      const document = await schema.json().catch(() => null);
      const paths = document?.paths;
      report.installation = {
        auth: 'Existing QA admin, public-key Auth, no service-role OpenAPI',
        capabilityStatus: capability.status,
        capabilityErrorCode: capability.error?.code ?? null,
        commercial105: !capability.error && capability.data?.commercial_version === 105 && capability.data?.atomic_commercial === true,
        atomicConversion: !capability.error && capability.data?.atomic_conversion === true,
        payroll106: !capability.error && capability.data?.atomic_payroll === true,
        authenticatedOpenApiStatus: schema.status,
        authenticatedOpenApiAvailable: schema.ok && paths && typeof paths === 'object',
        treasury107SetVisible: Boolean(paths?.['/rpc/set_default_treasury_account_atomic']),
        treasury107SaveVisible: Boolean(paths?.['/rpc/save_default_treasury_account_atomic']),
        treasury107ManualConfirmed: process.argv.includes('--confirm-sql-105-107'),
      };
      const status = report.installation;
      const treasuryMetadataPositive = status.authenticatedOpenApiAvailable && status.treasury107SetVisible && status.treasury107SaveVisible;
      report.readyForExecution = Boolean(status.commercial105 && status.atomicConversion && status.payroll106 && (treasuryMetadataPositive || status.treasury107ManualConfirmed));
      report.limitations.push('OpenAPI visibility is checked with authenticated public-key QA, not service_role. Inaccessible OpenAPI does not prove absence and can be replaced by explicit manual SQL confirmation. Execute preflight will prove107 with an absent target before any QA upgrade or document creation, and freshly check subscription eligibility without extending it.');
      report.restored = true; report.cleanupComplete = true; report.passed = true;
      console.log(JSON.stringify({ passed: true, mode: 'check-installed', readyForExecution: report.readyForExecution, installation: report.installation, businessWrites: 0, contractWrites: 0 })); return;
    }
    const ready = await capabilities();
    for (const role of ['operator', 'viewer']) await login(role);
    await login('admin');
    const original = await readSubscription();
    report.originalContract = { essential: original.plan_code === 'essentiel', usableExpiry: Boolean((original.trial_ends_at ?? original.trial_end) && Date.parse(original.trial_ends_at ?? original.trial_end) > Date.now()), hasStripeSubscription: Boolean(original.stripe_subscription_id) };
    if (readOnly) {
      report.financialSnapshot = fingerprints(await snapshot(financialTables)); report.readyForExecution = ready && process.argv.includes('--confirm-sql-105-107') && report.originalContract.essential && report.originalContract.usableExpiry && !report.originalContract.hasStripeSubscription; report.restored = true; report.cleanupComplete = true; report.passed = true;
      console.log(JSON.stringify({ passed: true, mode: 'read-only', checks: report.checks.length, readyForExecution: report.readyForExecution, businessWrites: 0, contractWrites: 0 })); return;
    }
    if (original.plan_code !== 'essentiel' || !['trial', 'trialing'].includes(original.status) || !report.originalContract.usableExpiry || original.stripe_subscription_id) throw Error('QA_UNPAID_USABLE_ESSENTIEL_TRIAL_REQUIRED');
    const backupDirectory = path.dirname(manifestPath);
    for (const name of fs.readdirSync(backupDirectory).filter(name => /^(?:qa-pro-http-|qa-hosted-actions-).*\.json$/.test(name))) {
      const prior = JSON.parse(fs.readFileSync(path.join(backupDirectory, name), 'utf8'));
      if (prior.restorationRequired || (prior.marker === MARKER && prior.cleanupRequired && !prior.cleanupComplete)) throw Error('QA_PENDING_RECOVERY_MUST_BE_REVIEWED_FIRST');
    }
    if (fs.existsSync(path.join(backupDirectory, 'qa-pro-http-audit.lock'))) throw Error('QA_OTHER_AUDIT_LOCK_PRESENT');
    lockPath = privatePath(path.join(backupDirectory, 'qa-hosted-actions-audit.lock'));
    lock = fs.openSync(lockPath, 'wx'); fs.writeFileSync(lock, String(process.pid));
    const premium = await service.from('subscription_plans').select('id').eq('code', 'premium').single();
    if (premium.error || !uuid.test(premium.data?.id ?? '')) throw Error('QA_PREMIUM_PLAN_REFERENCE_REQUIRED');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    recoveryPath = privatePath(path.join(backupDirectory, `qa-hosted-actions-${stamp}.json`));
    recovery = { marker: MARKER, organizationId: EXPECTED_ORG, run: EXPECTED_RUN, startedAt: new Date().toISOString(), noteMarker: 'FELEXIA QA ATOMIC ' + randomUUID(), originalSubscription: original, premiumPlanId: premium.data.id, planUpdateAttempted: false, restorationRequired: false, cleanupRequired: true, cleanupComplete: false, created: { sales_documents: [], purchase_documents: [], hr_payroll_periods: [] }, cleaned: {}, beforeFinancial: await snapshot(financialTables), beforeControlled: await snapshot(controlledTables), beforeAudit: await snapshot(auditTables) };
    saveRecovery();
    report.financesBefore = fingerprints(recovery.beforeFinancial);
    report.controlledBefore = fingerprints(recovery.beforeControlled);
    // Explicitly missing target only: prove107 before any plan change or document creation.
    await missingTreasuryTarget();
    recovery.planUpdateAttempted = true; recovery.restorationRequired = true; saveRecovery();
    const promoted = await cas(service.from('organization_subscriptions').update({ plan_code: 'premium', plan_id: premium.data.id }), original).select('*');
    if (promoted.error || promoted.data?.length !== 1) throw Error('QA_TEMPORARY_PLAN_CAS_FAILED');
    const expected = { ...original, plan_code: 'premium', plan_id: premium.data.id };
    check('Only QA plan references changed, no date or status', digest(businessContract(await readSubscription())) === digest(businessContract(expected)));
    await commercialActions();
    await payrollMissingSettings();
  } catch (error) {
    failure = error;
    report.error = /^QA_[A-Z0-9_]+$/.test(error.message) ? error.message : 'QA_ACTION_OR_READ_FAILED_REQUIRES_PRIVATE_REVIEW';
  } finally {
    if (execute && recovery) {
      try { await cleanup(); } catch { report.cleanupError = 'QA_OWN_CREATED_ROWS_REQUIRE_PRIVATE_RECOVERY'; failure ||= Error(report.cleanupError); }
      try { await restoreContract(); } catch { report.restoreError = 'QA_CONTRACT_REQUIRES_PRIVATE_RECOVERY'; failure ||= Error(report.restoreError); }
      try {
        const afterFinancial = await snapshot(financialTables); const afterControlled = await snapshot(controlledTables); const afterAudit = await snapshot(auditTables);
        report.financesAfter = fingerprints(afterFinancial); report.controlledAfter = fingerprints(afterControlled);
        check('All baseline financial rows and balances unchanged', digest(afterFinancial) === digest(recovery.beforeFinancial));
        check('All existing commercial HR and reference rows restored exactly', digest(afterControlled) === digest(recovery.beforeControlled));
        report.auditChanges = auditTables.filter(table => digest(afterAudit[table]) !== digest(recovery.beforeAudit[table])).map(table => ({ table, beforeCount: recovery.beforeAudit[table].length, afterCount: afterAudit[table].length, note: 'Expected QA numbering/usage audit preserved, never rewound' }));
      } catch { report.baselineError = 'QA_BASELINE_COMPARISON_REQUIRES_PRIVATE_REVIEW'; failure ||= Error(report.baselineError); }
    }
    for (const client of Object.values(clients)) await client.auth.signOut({ scope: 'local' }).catch(() => {});
    globalThis.fetch = originalFetch;
    if (lock !== undefined) { fs.closeSync(lock); if (lockPath) fs.unlinkSync(lockPath); }
    if (!readOnly) report.passed = !failure && report.restored && report.cleanupComplete;
    report.actionDiagnosticsCount = diagnostics.length;
    report.limitation = 'Real authenticated SDK actions with Next request/cache/navigation supplied, not browser forms. No payment/email/DGI/cron. Incomplete-settings payroll only; no settings reset. All detailed backups private.';
    saveReport();
  }
  if (failure) process.exitCode = 1;
  console.log(JSON.stringify({ passed: report.passed, mode: report.mode, checks: report.checks.length, restored: report.restored, cleanupComplete: report.cleanupComplete, financialRowsUnchanged: report.checks.some(check => check.name === 'All baseline financial rows and balances unchanged' && check.passed), limitations: report.limitations }));
}
main().catch(() => { console.error('QA harness unavailable. No private details printed. Review the private recovery journal if an execution had begun.'); process.exitCode = 1; });
