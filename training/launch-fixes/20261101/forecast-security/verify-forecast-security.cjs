/* Executes current forecast/export modules with bounded synthetic database rows. No cloud or business writes. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../../..');
const results = [];
function check(value, label) { assert(value, label); results.push(label); }
function load(file, mocks = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} }; cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/')) { const base = `src/${id.slice(2)}`; return load(fs.existsSync(path.join(root, base + '.ts')) ? base + '.ts' : base + '.tsx', mocks, cache); }
    if (id === 'react' || id === 'react/jsx-runtime' || id === 'next/image') return require(id);
    throw Error('Unexpected dependency ' + id);
  }, module, module.exports);
  cache.set(file, module.exports); return module.exports;
}
const forecast = load('src/lib/treasury/treasury-forecast.ts');
const org = 'organization-fixture';
function sample() {
  return {
    treasury_accounts: [
      { id: 'mad', organization_id: org, name: 'MAD bank', currency: 'MAD', status: 'active', archived_at: null, current_balance: 1000 },
      { id: 'eur', organization_id: org, name: 'EUR bank', currency: 'EUR', status: 'active', archived_at: null, current_balance: 900000 },
    ],
    customer_invoices: [
      { id: 'customer', organization_id: org, invoice_number: 'FAC-MAD', status: 'validated', archived_at: null, invoice_date: '2026-10-02', due_date: null, remaining_amount: 100, currency: 'MAD', customer: { name: '=HYPERLINK("https://example.invalid")' } },
      { id: 'customer-eur', organization_id: org, invoice_number: 'FAC-EUR', status: 'validated', archived_at: null, invoice_date: '2026-10-02', due_date: '2026-11-02', remaining_amount: 20000, currency: 'EUR', customer: { name: 'EUR customer' } },
      { id: 'future', organization_id: org, invoice_number: 'FAC-FUTURE', status: 'validated', archived_at: null, invoice_date: '2026-11-01', due_date: '2026-12-01', remaining_amount: 30000, currency: 'MAD' },
    ],
    supplier_invoices: [
      { id: 'supplier', organization_id: org, invoice_number: 'FF-MAD', status: 'validated', archived_at: null, invoice_date: '2026-10-02', due_date: '2026-11-02', remaining_amount: 50, currency: 'MAD', supplier: [{ name: 'Synthetic supplier' }] },
      { id: 'supplier-eur', organization_id: org, invoice_number: 'FF-EUR', status: 'validated', archived_at: null, invoice_date: '2026-10-02', due_date: '2026-11-02', remaining_amount: 10000, currency: 'EUR' },
    ],
    treasury_forecast_items: [
      { id: 'manual', organization_id: org, item_type: 'manual', direction: 'outflow', label: 'MAD rent', forecast_date: '2026-11-03', amount: 25, probability: 100, status: 'planned', archived_at: null, treasury_account_id: null },
      { id: 'manual-eur', organization_id: org, item_type: 'manual', direction: 'outflow', label: 'EUR rent', forecast_date: '2026-11-03', amount: 10000, probability: 100, status: 'planned', archived_at: null, treasury_account_id: 'eur' },
    ],
  };
}
function client(rows, failure = null) {
  const calls = [];
  return { calls, from(table) {
    const operation = { table, filters: [], start: 0, end: Infinity, order: null }; calls.push(operation);
    const q = {
      select() { return q; },
      eq(k, v) { operation.filters.push([k, row => row[k] === v]); return q; },
      is(k, v) { operation.filters.push([k, row => row[k] === v]); return q; },
      in(k, v) { operation.filters.push([k, row => v.includes(row[k])]); return q; },
      gt(k, v) { operation.filters.push([k, row => row[k] > v]); return q; },
      gte(k, v) { operation.filters.push([k, row => row[k] >= v]); return q; },
      lte(k, v) { operation.filters.push([k, row => row[k] <= v]); return q; },
      not(k) { operation.filters.push([k, row => !['cancelled', 'ignored'].includes(row[k])]); return q; },
      order(k, v) { operation.order = [k, v]; return q; },
      range(start, end) { operation.start = start; operation.end = end; return q; },
      then(resolve, reject) {
        if (failure && failure.table === table && operation.start >= (failure.start ?? 0)) return Promise.resolve({ data: null, error: { message: 'private provider SQL/schema cache detail' } }).then(resolve, reject);
        let selected = [...(rows[table] ?? [])];
        for (const [, predicate] of operation.filters) selected = selected.filter(predicate);
        if (operation.order) selected.sort((a, b) => String(a[operation.order[0]]).localeCompare(String(b[operation.order[0]])));
        return Promise.resolve({ data: selected.slice(operation.start, operation.end + 1), error: null }).then(resolve, reject);
      },
    }; return q;
  } };
}
const options = { from: '2026-11-01', to: '2026-11-03' };
async function main() {
  const originalTZ = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'Africa/Casablanca', 'America/New_York']) {
      process.env.TZ = timezone;
      const c = client(sample()); const result = await forecast.getTreasuryForecast(c, org, options);
      check(result.openingBalance === 1000 && result.closingForecastBalance === 1025, timezone + ' never adds EUR to MAD');
      check(result.availableAccounts.length === 1 && result.availableAccounts[0].id === 'mad', timezone + ' account selector reuses complete active MAD source');
      check(result.totalExpectedInflows === 100 && result.totalExpectedOutflows === 75, timezone + ' MAD totals reconcile');
      check(result.hypothesis.currency === 'MAD' && result.hypothesis.excludedAccountCount === 1 && result.hypothesis.excludedInvoiceCount === 2 && result.hypothesis.excludedManualItemCount === 1, timezone + ' exclusions are explicit and counted');
      check(result.alerts.some(alert => /MAD/.test(alert.title) && /sans|Aucun/.test(alert.message)), timezone + ' exclusion warning reaches screen and print alerts');
      check(result.inflows[0].thirdPartyName.startsWith('=HYPERLINK') && result.outflows.find(item => item.sourceType === 'supplier_invoice').thirdPartyName === 'Synthetic supplier', timezone + ' object and array relation names survive');
      check(!result.inflows.some(item => item.sourceId === 'future'), timezone + ' dates after period are absent from items and totals');
      check(result.daily.map(day => day.closingBalance).join(',') === '1100,1050,1025', timezone + ' cash flows land on exact inclusive calendar dates');
      for (const [date, offset, expected] of [['2026-12-31', 1, '2027-01-01'], ['2028-02-28', 1, '2028-02-29'], ['2026-03-08', 1, '2026-03-09']]) check(forecast.addDays(date, offset) === expected, timezone + ' UTC date arithmetic ' + date);
      check(c.calls.every(call => call.order?.[0] === 'id' && call.order[1].ascending === true && call.filters.some(([field]) => field === 'organization_id')), timezone + ' every paginated read has stable order and tenant filter');
    }
  } finally { if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ; }
  for (const selected of ['eur', "mad'),organization_id.eq.foreign"]) {
    const c = client(sample()); await assert.rejects(() => forecast.getTreasuryForecast(c, org, { ...options, treasuryAccountId: selected }), /compte actif en MAD/);
    check(c.calls.every(call => call.table === 'treasury_accounts'), 'Foreign-currency or injected account selection fails before invoice reads');
  }
  for (const bad of [{ from: '2026-02-30' }, { to: '2025-01-01' }, { to: '9999-12-31' }, { scenario: "realistic'); DROP TABLE" }, { direction: 'unknown' }]) {
    const c = client(sample()); await assert.rejects(() => forecast.getTreasuryForecast(c, org, { ...options, ...bad })); check(c.calls.length === 0, 'Invalid dates, huge period or injected enums fail before DB');
  }
  for (const table of Object.keys(sample())) {
    await assert.rejects(() => forecast.getTreasuryForecast(client(sample(), { table }), org, options), error => /Impossible de charger/.test(error.message) && /partielle/.test(error.message) && !error.message.includes('private provider'));
    check(true, table + ' outage or missing table never yields a partial forecast or raw provider error');
  }
  const many = sample();
  many.treasury_accounts = Array.from({ length: 1601 }, (_, i) => ({ ...many.treasury_accounts[0], id: 'account-' + String(i).padStart(5, '0'), current_balance: 1 }));
  many.customer_invoices = Array.from({ length: 1601 }, (_, i) => ({ ...many.customer_invoices[0], id: 'customer-' + String(i).padStart(5, '0'), remaining_amount: 1 }));
  many.supplier_invoices = Array.from({ length: 1601 }, (_, i) => ({ ...many.supplier_invoices[0], id: 'supplier-' + String(i).padStart(5, '0'), remaining_amount: 1 }));
  many.treasury_forecast_items = Array.from({ length: 1601 }, (_, i) => ({ ...many.treasury_forecast_items[0], id: 'manual-' + String(i).padStart(5, '0'), amount: 1 }));
  const volumeClient = client(many); const volume = await forecast.getTreasuryForecast(volumeClient, org, options);
  check(volume.hypothesis.activeAccountCount === 1601 && volume.hypothesis.invoiceCount === 1601 && volume.hypothesis.supplierInvoiceCount === 1601 && volume.hypothesis.manualItemCount === 1601, '1601 rows in each source are read once without the PostgREST first-page truncation');
  check(volume.availableAccounts.length === 1601, 'Account selector includes rows after the first API page');
  check(volume.closingForecastBalance === 0 && volume.totalExpectedInflows === 1601 && volume.totalExpectedOutflows === 3202, 'Multi-page balances and flow totals reconcile');
  check(Object.keys(many).every(table => volumeClient.calls.filter(call => call.table === table).map(call => call.start).join(',') === '0,500,1000,1500,1601'), 'Pagination reaches all rows plus an empty terminal page with stable offsets');
  await assert.rejects(() => forecast.getTreasuryForecast(client(many, { table: 'customer_invoices', start: 500 }), org, options), /Aucune prévision partielle/); check(true, 'Later-page failure rejects the entire forecast');
  const noManual = client(sample(), { table: 'treasury_forecast_items' }); const noManualResult = await forecast.getTreasuryForecast(noManual, org, { ...options, includeManualItems: false });
  check(noManualResult.totalExpectedOutflows === 50 && !noManual.calls.some(call => call.table === 'treasury_forecast_items'), 'Explicit no-manual mode never silently queries a failing optional source');
  const malformed = sample(); malformed.treasury_accounts[0].current_balance = '12bad'; await assert.rejects(() => forecast.getTreasuryForecast(client(malformed), org, options), /montant.*invalide/); check(true, 'Malformed money is not silently coerced to zero or a numeric prefix');
  const old = sample(); old.customer_invoices[0].invoice_date = '2026-09-01'; const overdue = await forecast.getTreasuryForecast(client(old), org, { ...options, includeOverdue: false }); check(overdue.inflows.length === 0, 'Fallback due dates obey overdue exclusion');
  const exportClient = client(sample());
  const exportRoute = load('src/app/tresorerie/previsions/export/route.ts', { '@/lib/auth': { requireActiveWorkspace: async () => ({ organization: { id: org } }) }, '@/lib/supabase/server': { createClient: async () => exportClient } });
  const response = await exportRoute.GET(new Request('https://example.test/tresorerie/previsions/export?from=2026-11-01&to=2026-11-03'));
  const csv = await response.text();
  check(response.status === 200 && response.headers.get('cache-control') === 'private, no-store' && /MAD/.test(response.headers.get('content-disposition')), 'CSV is private, no-store and explicitly MAD');
  check(csv.includes("'=HYPERLINK") && csv.includes('Synthetic supplier') && csv.includes('Exclusions : 1 compte(s), 2 facture(s), 1 prévision(s)'), 'CSV neutralizes formulas, retains joined parties and discloses monetary exclusions');
  const badExport = await exportRoute.GET(new Request('https://example.test/tresorerie/previsions/export?from=bad&to=9999-12-31'));
  check(badExport.status === 503 && /Aucun total partiel/.test(await badExport.text()), 'Invalid export has an explicit safe error instead of an empty or partial CSV');
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const { TreasuryForecastPrintView } = load('src/components/treasury/treasury-forecast-print-view.tsx');
  const printed = renderToStaticMarkup(React.createElement(TreasuryForecastPrintView, { identity: { name: 'Synthetic <script>alert(1)</script>', footerText: 'Synthetic only' }, forecast: await forecast.getTreasuryForecast(client(sample()), org, options) }));
  check(printed.includes('MAD, sans conversion') && printed.includes('Périmètre limité au MAD') && printed.includes('Synthetic supplier'), 'Real React print rendering discloses monetary scope, exclusions and joined supplier');
  check(!printed.includes('<script>') && printed.includes('&lt;script&gt;'), 'Print rendering escapes untrusted company names');
  fs.writeFileSync(path.join(__dirname, 'forecast-print.html'), printed);
  fs.writeFileSync(path.join(__dirname, 'forecast-fixtures.json'), JSON.stringify({ passed: true, assertions: results.length, scope: 'Current forecast, CSV route and readAllPages with synthetic ordered/paginated tenant rows. No hosted database, browser render or write.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, assertions: results.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
