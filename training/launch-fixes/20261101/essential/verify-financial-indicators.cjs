/* eslint-disable @typescript-eslint/no-require-imports */
// Real service/actions/components; SDK/session fixtures only. No environment/network.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../../../..');
const results = [];
const check = (condition, name) => { assert.ok(condition, name); results.push(name); };
const row = (id, extra = {}) => ({ id, organization_id: 'fixture-org', archived_at: null, ...extra });
const due = { due_date: '2000-01-01', payment_status: 'unpaid', paid_amount: 0 };
function fixture({ cap = 37, tables = {}, failTable = null, failFrom = 0, role = 'admin', expired = false, authError = null, rpcResult = null } = {}) {
  const queries = [], rpcs = [], cache = new Map(), invalidations = [];
  const workspace = { organization: { id: 'fixture-org' }, role, userId: 'fixture-admin', subscription: { status: 'active', currentPeriodEnd: expired ? '2000-01-01' : '2099-01-01', trialEndsAt: null } };
  const field = (record, key) => key.split('.').reduce((v, k) => v?.[k], record);
  function query(table) {
    let filters = [], orders = [], from = 0, to = Infinity, head = false;
    const q = {
      select(_fields, options = {}) { head = !!options.head; return q; },
      eq(k, v) { filters.push(r => field(r, k) === v); return q; },
      neq(k, v) { filters.push(r => field(r, k) !== v); return q; },
      is(k, v) { filters.push(r => (field(r, k) ?? null) === v); return q; },
      in(k, v) { filters.push(r => v.includes(field(r, k))); return q; },
      gte(k, v) { filters.push(r => field(r, k) >= v); return q; },
      lte(k, v) { filters.push(r => field(r, k) <= v); return q; },
      order(k) { orders.push(k); return q; },
      range(a, b) { from = a; to = b; return q; },
      insert() { throw Error('Unexpected direct insert before atomic default RPC'); },
      update() { throw Error('Unexpected direct update before atomic default RPC'); },
      then(resolve) {
        const selected = (tables[table] || []).filter(r => filters.every(predicate => predicate(r))).sort((a, b) => {
          for (const key of orders) { const cmp = String(field(a, key)).localeCompare(String(field(b, key))); if (cmp) return cmp; }
          return 0;
        });
        queries.push({ table, from, head, orders });
        const error = failTable === table && from >= failFrom ? { message: 'Synthetic read outage' } : null;
        return Promise.resolve({ data: error || head ? null : selected.slice(from, Math.min(to + 1, from + cap)), count: error ? null : selected.length, error }).then(resolve);
      },
    };
    return q;
  }
  const client = { from: query, async rpc(name, args) { rpcs.push({ name, args }); return rpcResult ?? { data: null, error: { message: 'TREASURY_ACCOUNT_NOT_FOUND' } }; } };
  function load(relative) {
    let file = path.resolve(root, relative);
    if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, console, Date, FormData, globalThis, require(name) {
      if (name === '@/lib/auth') return { requireActiveWorkspace: async () => { if (authError) throw authError; return workspace; } };
      if (name === '@/lib/supabase/server') return { createClient: async () => client };
      if (name === '@/lib/pro-access') return { requireProWorkspace: async () => workspace };
      if (name === '@/lib/sales') return { getSalesDocumentFlow: async () => [] };
      if (name === '@/lib/launch-access') return { hasFullErpAccess: () => false };
      if (name === 'next/cache') return { revalidatePath: value => invalidations.push(value) };
      if (name === 'next/navigation') return { redirect(value) { throw Error('REDIRECT:' + value); } };
      if (name === 'next/link') return { default: ({ children, href }) => React.createElement('a', { href }, children) };
      if (name === '@/components/ui/button') return { Button: ({ children }) => React.createElement('div', null, children) };
      if (name === '@/components/ui/card') return { Card: ({ children }) => React.createElement('section', null, children), CardContent: ({ children }) => React.createElement('div', null, children) };
      if (name === '@/components/erp/money-display') return { MoneyDisplay: ({ value }) => React.createElement('span', null, value + ' MAD') };
      if (name === '@/components/erp/page-header') return { PageHeader: ({ title }) => React.createElement('h1', null, title) };
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), name)));
      return require(name);
    } }, { filename: file });
    cache.set(file, module.exports); return module.exports;
  }
  return { load, queries, rpcs, invalidations };
}
async function main() {
  const invoices = [
    row('a', { ...due, status: 'validated', total_ttc: 240, remaining_amount: 240 }),
    row('b', { ...due, status: 'draft', total_ttc: 120, remaining_amount: 120 }),
    row('c', { ...due, status: 'cancelled', total_ttc: 60, remaining_amount: 60 }),
    row('d', { ...due, status: 'paid', total_ttc: 100, paid_amount: 100, remaining_amount: 0, payment_status: 'paid' }),
    row('e', { ...due, status: 'sent', total_ttc: 48, remaining_amount: 48 }),
    row('f', { ...due, status: 'partially_paid', total_ttc: 120, paid_amount: 24, remaining_amount: 96, payment_status: 'partial' }),
    row('g', { ...due, status: 'overdue', total_ttc: 96, remaining_amount: 96 }),
    row('h', { ...due, status: 'validated', total_ttc: 888, remaining_amount: 888, archived_at: '2026-01-01' }),
    row('i', { ...due, status: 'validated', total_ttc: 999, remaining_amount: 999, organization_id: 'foreign-org' }),
  ];
  let f = fixture({ tables: { customer_invoices: invoices, customer_payments: [row('p', { status: 'confirmed', amount: 100, available_amount: 20 }), row('x', { status: 'cancelled', amount: 90, available_amount: 90 })] } });
  let counts = await f.load('src/lib/invoices.ts').getInvoiceCounters();
  let payments = await f.load('src/lib/payments.ts').getPaymentCounters();
  check(counts.invoicedTotal === 604 && counts.remainingTotal === 480 && counts.paidTotal === 124, 'Only issued, unarchived own-company invoices contribute financial totals');
  check(counts.draft === 1 && counts.overdue === 4, 'Draft count is retained while draft/cancelled/paid invoices cannot be overdue');
  check(payments.remainingToCollect === 480 && payments.unpaidInvoices === 3 && payments.partiallyPaidInvoices === 1, 'Collection amount and invoice counts use the same issued scope');
  check(payments.receivedTotal === 100 && payments.availableTotal === 20 && payments.unallocatedCount === 1, 'Cancelled payments never contribute received or available money');
  f = fixture({ tables: { supplier_payments: [row('sp1', { status: 'confirmed', available_amount: 20 }), row('sp2', { status: 'partially_allocated', available_amount: 30 }), row('sp3', { status: 'allocated', available_amount: 0 }), row('sp4', { status: 'cancelled', available_amount: 900 }), row('sp5', { status: 'confirmed', available_amount: 900, organization_id: 'foreign-org' }), row('sp6', { status: 'confirmed', available_amount: 900, archived_at: '2026-01-01' })] } });
  check((await f.load('src/lib/purchases.ts').getPurchaseCounters()).unallocatedPayments === 50, 'Supplier available money includes partially allocated payments and excludes cancelled/foreign/archived payments');
  for (const cap of [37, 1000]) {
    const many = Array.from({ length: 1101 }, (_, i) => row('i-' + i, { ...due, status: 'validated', total_ttc: 1, remaining_amount: 1 }));
    const paymentRows = many.map((r, i) => row('p-' + i, { status: 'confirmed', amount: 1, available_amount: 1 }));
    f = fixture({ cap, tables: { customer_invoices: many, customer_payments: paymentRows, supplier_invoices: many, supplier_payments: paymentRows } });
    counts = await f.load('src/lib/invoices.ts').getInvoiceCounters();
    payments = await f.load('src/lib/payments.ts').getPaymentCounters();
    const purchases = await f.load('src/lib/purchases.ts').getPurchaseCounters();
    check(counts.invoicedTotal === 1101 && counts.remainingTotal === 1101 && counts.overdue === 1101, 'Invoice KPI complete for1101 rows under cap' + cap);
    check(payments.receivedTotal === 1101 && payments.availableTotal === 1101 && payments.remainingToCollect === 1101, 'Payment KPI complete under cap' + cap);
    check(purchases.totalToPay === 1101 && purchases.unpaidInvoices === 1101 && purchases.unallocatedPayments === 1101, 'Supplier amount/count/available complete under cap' + cap);
    check(f.queries.filter(q => !q.head).every(q => q.orders.includes('id')), 'All paginated financial reads use stable unique id ordering under cap' + cap);
  }
  for (const table of ['customer_invoices', 'customer_payments', 'supplier_invoices', 'supplier_payments', 'purchase_documents']) {
    const many = Array.from({ length: 80 }, (_, i) => row('i-' + i, { ...due, status: 'validated', total_ttc: 1, remaining_amount: 1 }));
    f = fixture({ failTable: table, failFrom: table === 'purchase_documents' ? 0 : 37, tables: { customer_invoices: many, customer_payments: many, supplier_invoices: many, supplier_payments: many.map(r => ({ ...r, status: 'confirmed', available_amount: 1 })) } });
    if (table.startsWith('supplier_') || table === 'purchase_documents') {
      const service = f.load('src/lib/purchases.ts');
      await assert.rejects(() => service.getPurchaseCounters(), /indicateurs d’achats/); results.push('Supplier read failure is explicit, including later-page failure:' + table);
      check(await service.getPurchaseCountersForDisplay() === null, 'Unavailable supplier KPI is null rather than zero:' + table);
    } else {
      await assert.rejects(() => f.load(table === 'customer_payments' ? 'src/lib/payments.ts' : 'src/lib/invoices.ts')[table === 'customer_payments' ? 'getPaymentCounters' : 'getInvoiceCounters'](), /Synthetic read outage/); results.push('Client later-page read failure never returns partial money:' + table);
    }
  }
  const authFailure = Error('AUTH_REDIRECT_SENTINEL');
  f = fixture({ authError: authFailure });
  await assert.rejects(() => f.load('src/lib/purchases.ts').getPurchaseCountersForDisplay(), error => error === authFailure); results.push('Authentication/navigation exceptions are not swallowed into unavailable counters');
  const dashboard = f.load('src/components/purchases/purchase-dashboard.tsx').PurchaseDashboard;
  const html = renderToStaticMarkup(React.createElement(dashboard, { counters: null }));
  check(html.includes('momentanément indisponibles') && html.includes('role="status"') && !html.includes('0 MAD') && !html.includes('Montant a payer'), 'Actual purchases dashboard renders unavailable status and no financial zero/cards');

  const lines = Array.from({ length: 10001 }, (_, i) => row('line-' + i, { line_number: i, debit: 1, credit: 0, entry: { id: 'e-' + i, entry_number: 'E-' + i, entry_date: '2026-11-01', status: 'posted', journal: { code: 'BQ' } } }));
  lines.push(row('outside', { debit: 99, entry: { entry_date: '2026-12-01', status: 'posted' } }), row('draft', { debit: 99, entry: { entry_date: '2026-11-01', status: 'draft' } }), row('foreign', { organization_id: 'foreign-org', debit: 99, entry: { entry_date: '2026-11-01', status: 'posted' } }));
  for (const cap of [37, 1000, 10000]) {
    f = fixture({ cap, tables: { accounting_entry_lines: lines } });
    const report = await f.load('src/lib/accounting.ts').getAccountingReportLines({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    check(report.length === 10001 && new Set(report.map(r => r.id)).size === 10001 && report.reduce((sum, r) => sum + r.debit, 0) === 10001, 'Accounting report includes10001 unique posted own-company in-period lines under cap' + cap);
    check(f.queries.every(q => q.orders.includes('id')), 'Accounting report uses stable unique ordering under cap' + cap);
  }
  f = fixture({ failTable: 'accounting_entry_lines', failFrom: 37, tables: { accounting_entry_lines: lines } });
  await assert.rejects(() => f.load('src/lib/accounting.ts').getAccountingReportLines(), /Synthetic read outage/); results.push('Accounting later-page outage refuses a partial report');

  const id = '11111111-1111-4111-8111-111111111111';
  const form = new FormData(); form.set('id', id); form.set('name', 'Synthetic bank'); form.set('is_default', 'on');
  for (const result of [{ data: null, error: { message: 'TREASURY_ACCOUNT_NOT_FOUND' } }, { data: null, error: { code: 'PGRST202' } }, { data: null, error: null }]) {
    f = fixture({ rpcResult: result });
    const action = await f.load('src/lib/treasury-actions.ts').setDefaultTreasuryAccount({ success: false }, form);
    check(!action.success && f.queries.length === 0 && f.rpcs.length === 1, 'Failed/missing/unconfirmed default RPC never resets preferences with direct SDK writes:' + (result.error?.message || result.error?.code || 'empty'));
  }
  f = fixture({ rpcResult: { data: id, error: null } });
  check((await f.load('src/lib/treasury-actions.ts').setDefaultTreasuryAccount({ success: false }, form)).success && f.invalidations.includes('/tresorerie/comptes'), 'Confirmed default RPC returns success and refreshes account list');
  for (const role of ['viewer', 'operator']) {
    f = fixture({ role });
    check(!(await f.load('src/lib/treasury-actions.ts').setDefaultTreasuryAccount({ success: false }, form)).success && f.rpcs.length === 0, role + ' cannot invoke preferred-account write RPC from action');
  }
  f = fixture({ expired: true });
  await assert.rejects(() => f.load('src/lib/treasury-actions.ts').setDefaultTreasuryAccount({ success: false }, form), /consultation/); results.push('Expired account cannot invoke preferred-account mutation');
  for (const actionName of ['createTreasuryAccount', 'updateTreasuryAccount']) {
    f = fixture({ rpcResult: { data: null, error: { message: 'Synthetic atomic save failure' } } });
    const action = await f.load('src/lib/treasury-actions.ts')[actionName]({ success: false }, form);
    check(!action.success && f.queries.length === 0 && f.rpcs[0].name === 'save_default_treasury_account_atomic', actionName + ' failure cannot leave a preceding direct insert/update');
    f = fixture({ rpcResult: { data: id, error: null } });
    await assert.rejects(() => f.load('src/lib/treasury-actions.ts')[actionName]({ success: false }, form), new RegExp('REDIRECT:/tresorerie/comptes/' + id)); results.push(actionName + ' successful RPC opens the saved account');
    check(f.rpcs[0].args.p_organization_id === 'fixture-org' && f.queries.length === 0, actionName + ' identity remains bound to the authenticated workspace');
  }
  fs.writeFileSync(path.join(__dirname, 'financial-indicators.json'), JSON.stringify({ at: new Date().toISOString(), passed: true, checks: results.length, results, scope: 'Real TS services/actions and SSR component with deterministic SDK/session fixtures; zero network or cloud mutations', caps: [37, 1000, 10000] }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: results.length, cloudMutations: 0 }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
