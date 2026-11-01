/* eslint-disable @typescript-eslint/no-require-imports -- Explicit read-only Node QA. */
// Existing synthetic QA company only. Authentication plus GET/read-only RPCs.
// No service key, business write, invitation, billing change or document generation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const manifestPath = process.argv.find(a => a.startsWith('--manifest='))?.slice(11);
if (!manifestPath || !process.argv.includes('--read-only')) throw Error('Explicit private QA manifest and --read-only required');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest.run?.startsWith('essential-final-') || !manifest.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !manifest.organizationId) throw Error('Existing synthetic essential recette manifest required');
const [mailbox, domain] = String(manifest.authorizedMailbox ?? '').toLowerCase().split('@');
for (const role of ['admin', 'operator', 'viewer']) {
  const email = String(manifest.users?.[role]?.email ?? '').toLowerCase();
  assert(email.startsWith(mailbox + '+recette') && email.endsWith(role + '@' + domain), 'Authorized synthetic alias required');
}
require(path.join(root, 'node_modules/@next/env')).loadEnvConfig(root, false, { info() {}, error() {} });
const { createClient } = require(path.join(root, 'node_modules/@supabase/supabase-js'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || key === process.env.SUPABASE_SERVICE_ROLE_KEY || key.startsWith('sb_secret_')) throw Error('Public project configuration required');
const report = { date: new Date().toISOString(), scope: 'Existing synthetic QA company; public Auth, GETs and stable capability RPC only', businessWrites: 0, billingWrites: 0, emailsSent: 0, checks: [], tableReads: [] };
function check(name, passed) { report.checks.push({ name, passed: Boolean(passed) }); assert(passed, name); }
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
async function snapshot(db) {
  const tables = {
    customer_invoices: 'id,status,total_ttc,paid_amount,credit_amount,remaining_amount',
    supplier_invoices: 'id,status,total_ttc,paid_amount,credit_amount,remaining_amount',
    customer_payments: 'id,status,amount,allocated_amount,available_amount',
    supplier_payments: 'id,status,amount,allocated_amount,available_amount',
    treasury_accounts: 'id,currency,current_balance',
    treasury_transactions: 'id,direction,amount,currency,archived_at',
    accounting_entries: 'id,status,total_debit,total_credit',
    accounting_entry_lines: 'id,entry_id,debit,credit',
  };
  const result = {};
  for (const [table, select] of Object.entries(tables)) {
    const response = await db.from(table).select(select).eq('organization_id', manifest.organizationId).order('id');
    if (response.error) throw Error('Scoped financial snapshot unavailable: ' + table + ' ' + response.error.code);
    result[table] = response.data;
  }
  return { hash: createHash('sha256').update(JSON.stringify(result)).digest('hex'), rowCounts: Object.fromEntries(Object.entries(result).map(([table, rows]) => [table, rows.length])) };
}
(async () => {
  const db = client();
  const login = await db.auth.signInWithPassword({ email: manifest.users.admin.email, password: manifest.users.admin.password });
  check('Existing authorized QA admin authenticates', !login.error && !!login.data.user?.id);
  const membership = await db.from('organization_members').select('organization_id,status').eq('organization_id', manifest.organizationId).eq('user_id', login.data.user.id).maybeSingle();
  check('QA admin has active membership in the exact synthetic company', !membership.error && membership.data?.status === 'active');
  const before = await snapshot(db);
  const subscription = await db.from('organization_subscriptions').select('plan_code,status,current_period_end,trial_ends_at').eq('organization_id', manifest.organizationId).maybeSingle();
  check('Existing company remains on Essentiel', !subscription.error && subscription.data?.plan_code === 'essentiel');
  const capabilities = await db.rpc('erp_get_capabilities', { p_organization_id: manifest.organizationId });
  check('Installed hosted capability confirms version104 and PRO write guards', !capabilities.error && capabilities.data?.workflow_version === 104 && capabilities.data?.pro_write_guards === true);
  const foreign = await db.rpc('erp_get_capabilities', { p_organization_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
  check('Authenticated nonmember company capability denied', !!foreign.error && /SUBSCRIPTION_MEMBERSHIP_REQUIRED/.test(foreign.error.message));
  const anonymous = await client().rpc('erp_get_capabilities', { p_organization_id: manifest.organizationId });
  check('Anonymous capability denied', !!anonymous.error && ['42501', 'PGRST301', 'PGRST302'].includes(anonymous.error.code));
  for (const table of ['third_parties','products','customer_invoices','supplier_invoices','treasury_accounts','accounting_journals','sales_documents','purchase_documents','stock_moves','stock_levels','documents','vat_declarations','hr_departments','hr_employees']) {
    const response = await db.from(table).select('organization_id', { count: 'exact', head: true }).eq('organization_id', manifest.organizationId);
    report.tableReads.push({ table, status: response.status, count: response.count, passed: !response.error });
    check('Existing Essentiel company retains scoped read of ' + table, !response.error);
  }
  const after = await snapshot(db);
  check('Financial balances, invoice totals and accounting rows unchanged', before.hash === after.hash);
  report.financialSnapshot = { before: before.hash, after: after.hash, rowCounts: after.rowCounts };
  report.passed = true;
  fs.writeFileSync(path.join(__dirname, 'production-readonly.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: report.checks.length, businessWrites: 0, billingWrites: 0, financeUnchanged: true }));
})().catch(error => { report.passed = false; report.error = error.message; fs.writeFileSync(path.join(__dirname, 'production-readonly.json'), JSON.stringify(report, null, 2) + '\n'); console.error(error.message); process.exitCode = 1; });
