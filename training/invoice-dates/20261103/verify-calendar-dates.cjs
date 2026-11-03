/* Calendar-date regression against actual format and invoice React modules.
 * Synthetic props only. No SDK, authentication, database, or business actions.
 * Run: npx --yes --package=node@22 node training/invoice-dates/20261103/verify-calendar-dates.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { DomUtils, parseDocument } = require('htmlparser2');
const root = path.resolve(__dirname, '../../..');
const zones = ['UTC', 'Africa/Casablanca', 'America/Los_Angeles', 'Pacific/Honolulu', 'Pacific/Kiritimati'];
const calendarCases = [
  ['2026-10-05', '05 oct. 2026'],
  ['2026-11-05', '05 nov. 2026'],
  ['2026-12-31', '31 déc. 2026'],
  ['2027-01-01', '01 jan. 2027'],
  ['2027-01-30', '30 jan. 2027'],
  ['2028-02-28', '28 fév. 2028'],
  ['2028-02-29', '29 fév. 2028'],
  ['2028-03-01', '01 mar. 2028'],
  ['2028-03-30', '30 mar. 2028'],
  ['2026-02-14', '14 fév. 2026'],
  ['2026-02-15', '15 fév. 2026'],
  ['2026-02-16', '16 fév. 2026'],
  ['2026-03-21', '21 mar. 2026'],
  ['2026-03-22', '22 mar. 2026'],
  ['2026-03-23', '23 mar. 2026'],
  ['2026-03-08', '08 mar. 2026'],
  ['2026-11-01', '01 nov. 2026'],
];

function invoiceFixture(invoiceDate = '2026-10-05', dueDate = '2026-11-05') {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    organization_id: '20000000-0000-4000-8000-000000000001',
    invoice_number: 'FACTURE-FICTIVE-001', supplier_invoice_number: 'FOURNISSEUR-FICTIF-001',
    customer_id: '30000000-0000-4000-8000-000000000001', supplier_id: '40000000-0000-4000-8000-000000000001',
    customer_name: 'Client fictif', supplier_name: 'Fournisseur fictif',
    source_type: 'manual', source_document_id: null, source_order_id: null,
    source_delivery_id: null, source_receipt_id: null,
    invoice_date: invoiceDate, due_date: dueDate, status: 'draft', payment_status: 'unpaid',
    payment_terms_days: 30, paid_amount: 0, credit_amount: 0, remaining_amount: 120,
    subtotal_ht: 100, discount_total: 0, tax_total: 20, total_ttc: 120, currency: 'MAD',
    payment_terms: null, payment_method: null, custom_payment_terms: null, custom_payment_method: null,
    notes: null, internal_notes: null, validated_at: null, sent_at: null,
    cancelled_at: null, created_by: null, archived_at: null,
    created_at: '2026-10-05T00:30:00Z', updated_at: '2026-10-05T00:30:00Z',
  };
}

function identityFixture() {
  return { name: 'Entreprise fictive', currency: 'MAD', logoUrl: null,
    address: 'Adresse de recette', city: 'Ville fictive', country: 'Maroc',
    ice: null, rc: null, ifNumber: null, patente: null, cnss: null,
    email: null, phone: null, website: null, footerText: 'Document de recette sans valeur commerciale' };
}

function actualModuleLoader() {
  const cache = new Map();
  let attemptedActions = 0;
  const forbiddenActions = new Set(['@/lib/invoice-actions', '@/lib/purchase-actions', '@/lib/accounting-actions']);
  const inertActions = new Proxy({}, { get() { return () => { attemptedActions++; throw Error('Business actions are not connected in this regression'); }; } });
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep)) throw Error('Source must remain in this workspace');
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (forbiddenActions.has(name)) return inertActions;
      if (name === 'next/link') return { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children) };
      if (name === 'next/image') return { __esModule: true, default: ({ fill, priority, ...props }) => React.createElement('img', props) };
      if (name.startsWith('@/')) {
        const basename = path.join('src', name.slice(2));
        const file = [basename + '.ts', basename + '.tsx'].find(candidate => fs.existsSync(path.join(root, candidate)));
        if (!file) throw Error('Unexpected source import ' + name);
        return load(file);
      }
      if (name === 'react' || name === 'react/jsx-runtime' || name === 'lucide-react') return require(name);
      throw Error('Unexpected dependency ' + name);
    };
    vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return { load, actionCount: () => attemptedActions };
}

function invoiceViewComponents(loader) {
  return {
    customerList: loader.load('src/components/invoices/customer-invoices-table.tsx').CustomerInvoicesTable,
    customerDetail: loader.load('src/components/invoices/customer-invoice-detail.tsx').CustomerInvoiceDetail,
    customerPrint: loader.load('src/components/invoices/customer-invoice-print-view.tsx').CustomerInvoicePrintView,
    supplierList: loader.load('src/components/purchases/purchase-documents-table.tsx').SupplierInvoicesTable,
    supplierDetail: loader.load('src/components/purchases/supplier-invoice-detail.tsx').SupplierInvoiceDetail,
    supplierPrint: loader.load('src/components/purchases/supplier-invoice-print-view.tsx').SupplierInvoicePrintView,
  };
}

function renderViews(components, invoice) {
  const html = {};
  for (const [name, Component] of Object.entries(components)) {
    const props = name.endsWith('List') ? { rows: [invoice] }
      : { invoice, lines: [], identity: identityFixture(), canWrite: false, fullAccess: false, canPostAccounting: false, payments: [], paymentSummary: null };
    html[name] = renderToStaticMarkup(React.createElement(Component, props));
  }
  return html;
}

function visibleText(html) { return DomUtils.textContent(parseDocument(html)).replace(/\s+/g, ' ').trim(); }

function worker() {
  const checks = [];
  const check = (value, description) => { assert.ok(value, description); checks.push(description); };
  const loader = actualModuleLoader();
  const format = loader.load('src/lib/format.ts');
  const legacy = (value) => new Intl.DateTimeFormat('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  const actual = calendarCases.map(([value, expected]) => {
    const output = format.formatDate(value);
    check(output === expected, value + ' retains its entered calendar date');
    return { value, output };
  });
  const timestampCases = [
    '2026-10-05T00:30:00Z', '2026-10-05T00:15:00+01:00',
    '2026-12-31T23:30:00Z', '2027-01-01T00:15:00+14:00',
    '2026-10-05T23:30:00-10:00', '2026-10-05T00:30:00',
  ];
  for (const value of timestampCases) {
    check(format.formatDate(value) === legacy(value), value + ' keeps native instant formatting');
    const object = new Date(value), before = object.getTime();
    check(format.formatDate(object) === legacy(object), value + ' Date object keeps native instant formatting');
    check(object.getTime() === before, value + ' input Date is not mutated');
  }
  assert.throws(() => format.formatDate('not-a-date'), RangeError); checks.push('Invalid input retains the existing RangeError behavior');
  assert.throws(() => format.formatDate(new Date(NaN)), RangeError); checks.push('Invalid Date object retains the existing RangeError behavior');
  check(format.formatMoney(1234.5) === new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(1234.5), 'Currency rendering is unchanged');
  check(format.formatNumber(1234.5) === new Intl.NumberFormat('fr-MA').format(1234.5), 'Number rendering is unchanged');
  const components = invoiceViewComponents(loader);
  for (const [date, expected, due, dueExpected] of [
    ['2026-10-05', '05 oct. 2026', '2026-11-05', '05 nov. 2026'],
    ['2026-12-31', '31 déc. 2026', '2027-01-30', '30 jan. 2027'],
    ['2028-02-29', '29 fév. 2028', '2028-03-30', '30 mar. 2028'],
  ]) {
    const invoice = invoiceFixture(date, due), before = JSON.stringify(invoice);
    const rendered = renderViews(components, invoice);
    for (const [view, markup] of Object.entries(rendered)) {
      const text = visibleText(markup);
      check(text.includes(expected), view + ' displays the entered ' + date + ' with actual React source');
      if (view !== 'supplierList') check(text.includes(dueExpected), view + ' preserves due date ' + due);
      if (view.endsWith('Detail')) check(text.includes('Cree le ' + legacy(invoice.created_at)), view + ' retains native audit timestamp rendering');
      check(!markup.includes('<form'), view + ' does not expose business submission in this read-only fixture');
    }
    check(JSON.stringify(invoice) === before, date + ' rendering never rewrites invoice props');
  }
  check(loader.actionCount() === 0, 'No business action was executed');
  let seasonalOffsets;
  if (process.env.TZ === 'Africa/Casablanca') {
    seasonalOffsets = ['2026-02-14', '2026-02-15', '2026-02-16', '2026-03-21', '2026-03-22', '2026-03-23']
      .map(value => ({ value, offsetMinutes: new Date(value + 'T12:00:00Z').getTimezoneOffset() }));
    check(new Set(seasonalOffsets.map(row => row.offsetMinutes)).size > 1, 'Casablanca fixture spans actual runtime Ramadan-season offset changes');
  }
  const legacyReproduction = legacy('2026-10-05');
  if (['America/Los_Angeles', 'Pacific/Honolulu'].includes(process.env.TZ)) {
    check(legacyReproduction === '04 oct. 2026', 'Legacy implementation reproduces the reported previous-day symptom');
  }
  return { timezone: process.env.TZ, runtime: process.version, resolvedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    passed: checks.length, checks, calendarValues: actual, legacyReproduction, seasonalOffsets, businessActions: loader.actionCount() };
}

function main() {
  const results = zones.map(timezone => {
    const child = spawnSync(process.execPath, [__filename, '--zone-worker'], { encoding: 'utf8', env: { ...process.env, TZ: timezone }, maxBuffer: 2 * 1024 * 1024 });
    if (child.status !== 0) throw Error(timezone + ' worker failed:\n' + child.stderr + child.stdout);
    return JSON.parse(child.stdout);
  });
  const reference = JSON.stringify(results[0].calendarValues);
  assert.ok(results.every(result => JSON.stringify(result.calendarValues) === reference), 'Calendar dates agree across server/browser zones');
  const report = { success: true, date: new Date().toISOString(), runtime: process.version,
    passed: results.reduce((total, result) => total + result.passed, 0) + 1,
    globalCheck: 'Identical calendar output in every isolated timezone process', results,
    scope: 'Actual format helper and six actual invoice list/detail/print React components. Controlled Next Link/Image and inert action imports; no network, authentication, database, or new invoice.',
    accountsCreated: 0, invoicesCreated: 0, businessWrites: 0 };
  fs.writeFileSync(path.join(__dirname, 'calendar-date-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, runtime: process.version, passed: report.passed, timezones: zones, businessWrites: 0 }, null, 2));
}

module.exports = { root, zones, calendarCases, invoiceFixture, identityFixture, actualModuleLoader, invoiceViewComponents, renderViews };
if (require.main === module) {
  try { if (process.argv.includes('--zone-worker')) console.log(JSON.stringify(worker())); else main(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
