/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-page SSR fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../../..');
const id = '11111111-2222-4333-8444-555555555555';
const results = [];
const cache = new Map();
let profile = { role: 'admin', expired: false };
let documentType = 'quote';
let status = 'draft';
let mutations = 0;
function check(label, condition) { assert.ok(condition, label); results.push(label); }
function denyEffect() { mutations++; throw new Error('SSR may not mutate, fetch or contact an external service'); }
const actionStubs = new Proxy({}, { get(_target, key) { return key === '__esModule' ? true : denyEffect; } });
function workspace() {
  return { role: profile.role, organization: { id, name: 'Fixture company' }, subscription: {
    planCode: 'premium', status: 'active', currentPeriodEnd: new Date(Date.now() + (profile.expired ? -1 : 1) * 86400000).toISOString(),
  } };
}
function document() {
  return { id, organization_id: id, document_type: documentType, status, document_number: 'DOC-FIXTURE-001',
    customer_id: id, customer_name: 'Client fixture', supplier_name: 'Fournisseur fixture',
    document_date: '2026-11-01', created_at: '2026-11-01T00:00:00Z', subtotal_ht: 100, tax_total: 20, total_ttc: 120,
    discount_total: 0, stock_updated_at: null, customer_types: ['customer'],
  };
}
function declaration() {
  return { id, declaration_number: 'TVA-FIXTURE-001', status: 'draft', period_start: '2026-11-01', period_end: '2026-11-30',
    frequency: 'monthly', vat_regime: 'debits', blocking_errors_count: 0, warnings_count: 0, totals_by_rate: {},
    validation_summary: { issues: [] }, collected_vat: 20, deductible_vat: 0, vat_due: 20, credit_to_carry_forward: 0,
    prior_credit: 0, taxable_turnover: 100, customer_invoices_count: 1, supplier_invoices_count: 0,
    created_at: '2026-11-01', updated_at: '2026-11-01',
  };
}
const location = { id, name: 'Depot fixture', code: 'DEPOT', location_type: 'depot', status: 'active', is_default: false };
function load(relative) {
  let absolute = path.resolve(root, relative);
  if (!path.extname(absolute)) absolute = ['.ts', '.tsx'].map(ext => absolute + ext).find(file => fs.existsSync(file));
  if (!absolute || !absolute.startsWith(root + path.sep)) throw new Error('Unexpected source');
  if (cache.has(absolute)) return cache.get(absolute);
  const moduleState = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: absolute,
  }).outputText;
  vm.runInNewContext(code, {
    module: moduleState, exports: moduleState.exports, URL, URLSearchParams, Date, Error, FormData,
    process: { env: {} }, fetch: denyEffect, console: { error() {}, warn() {} },
    require(name) {
      if (['react', 'react/jsx-runtime', 'lucide-react'].includes(name)) return require(name);
      if (name === 'server-only') return {};
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name === 'next/navigation') return { notFound: denyEffect, redirect: denyEffect };
      if (name === '@/lib/auth') return { requireActiveWorkspace: async () => workspace() };
      if (name === '@/components/erp/module-page') return { ModulePage: ({ children }) => React.createElement('main', null, children) };
      if (name === '@/lib/launch-access') return { hasFullErpAccess: async () => true };
      if (name === '@/lib/app-url') return { getAppUrl: () => 'https://fixture.example.invalid' };
      if (name === '@/lib/sales') return { getSalesDocumentDetail: async () => ({ document: document(), lines: [] }), getSalesDocumentFlow: async () => [] };
      if (name === '@/lib/purchases') return {
        getPurchaseDocumentDetail: async () => ({ document: document(), lines: [] }), getPurchaseDocumentFlow: async () => [],
        getSupplierInvoiceByReceiptId: async () => null, getPurchaseReceiptArchiveEligibility: async () => ({ canArchive: true }), getStockMovesForReceipt: async () => [],
      };
      if (name === '@/lib/invoices') return { getOrderBillingGuard: async () => ({ isBlocked: false, directInvoice: null, deliveryInvoices: [] }) };
      if (name === '@/lib/credit-notes') return { getCreditNoteByReturnId: async () => null };
      if (name === '@/lib/stock-locations') return { getStockLocationDetail: async () => ({ location, stockLevels: [], movements: [] }), getStockLocationTypeLabel: () => 'Depot' };
      if (name === '@/lib/tax/vat-declarations') return { getVatDeclarationById: async () => declaration() };
      if (name === '@/lib/tax/dgi-vat-xlsx') return { DGI_VAT_XLSX_AVAILABLE: false };
      if (name === '@/lib/tax/vat-anomaly-autofix') return { classifyVatAnomaly: () => ({ fixability: 'auto_fixable', actionLabel: 'Correction possible' }) };
      if (name.startsWith('@/lib/') && (name.includes('-actions') || name.endsWith('/actions'))) return actionStubs;
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(absolute), name)));
      throw new Error('Unmodeled SSR dependency: ' + name);
    },
  }, { filename: absolute });
  cache.set(absolute, moduleState.exports);
  return moduleState.exports;
}
async function renderPage(file) {
  return renderToStaticMarkup(await load(file).default({ params: Promise.resolve({ id }) }));
}
function renderComponent(file, name, props) { return renderToStaticMarkup(React.createElement(load(file)[name], props)); }

async function main() {
  const cases = [
    { type: 'quote', file: 'src/app/vente/devis/[id]/page.tsx', mutation: 'Marquer envoye' },
    { type: 'order', file: 'src/app/vente/commandes/[id]/page.tsx', mutation: 'Confirmer commande' },
    { type: 'delivery_note', file: 'src/app/vente/livraisons/[id]/page.tsx', mutation: '>Valider<' },
    { type: 'return_note', file: 'src/app/vente/retours/[id]/page.tsx', mutation: 'Valider retour' },
    { type: 'supplier_order', file: 'src/app/achats/commandes/[id]/page.tsx', mutation: '>Confirmer<' },
    { type: 'supplier_receipt', file: 'src/app/achats/receptions/[id]/page.tsx', mutation: 'Valider reception' },
  ];
  for (const fixture of cases) {
    documentType = fixture.type; status = 'draft'; profile = { role: 'admin', expired: false };
    let html = await renderPage(fixture.file);
    check(fixture.type + ': active admin retains mutation action', html.includes(fixture.mutation) && html.includes('<form'));
    check(fixture.type + ': active admin retains print link', html.includes('/print'));
    for (const options of [{ role: 'viewer' }, { role: 'admin', expired: true }, { role: 'operator' }]) {
      profile = { expired: false, ...options };
      html = await renderPage(fixture.file);
      check(fixture.type + ': no mutation forms for ' + JSON.stringify(profile), !html.includes('<form') && !html.includes(fixture.mutation));
      check(fixture.type + ': reading and print remain for ' + JSON.stringify(profile), html.includes('DOC-FIXTURE-001') && html.includes('/print'));
      check(fixture.type + ': no creation or edit URL for ' + JSON.stringify(profile), !/href="[^"]*\/(?:new|edit|livrer|retour)(?:[?/"])/.test(html));
    }
  }
  for (const options of [{ role: 'admin', expired: false }, { role: 'viewer', expired: false }, { role: 'admin', expired: true }]) {
    profile = options;
    const canWrite = load('src/lib/pro-access.ts').canWriteProWorkspace(workspace());
    const html = renderComponent('src/components/stock/stock-locations-table.tsx', 'StockLocationsTable', { rows: [location], canWrite });
    check('Stock row mutation controls follow ' + JSON.stringify(profile), html.includes('title="Modifier"') === canWrite && html.includes('<form') === canWrite);
    check('Stock row consultation remains ' + JSON.stringify(profile), html.includes('title="Voir"') && html.includes('Depot fixture'));
    const detail = await renderPage('src/app/stock/emplacements/[id]/page.tsx');
    check('Stock detail edit link follows ' + JSON.stringify(profile), detail.includes('/edit') === canWrite);
    check('Stock detail read remains ' + JSON.stringify(profile), detail.includes('Depot fixture'));
    const vat = await renderPage('src/app/comptabilite/tva/declarations/[id]/page.tsx');
    check('VAT mutation buttons follow ' + JSON.stringify(profile), vat.includes('<form') === canWrite && vat.includes('Valider la déclaration') === canWrite);
    check('VAT detail read and export consultation remain ' + JSON.stringify(profile), vat.includes('TVA-FIXTURE-001') && vat.includes('/comptabilite/tva/exports'));
    const wizard = renderComponent('src/components/comptabilite/tva/dgi-export-wizard.tsx', 'DgiExportWizard', { periodStart: '2026-11-01', periodEnd: '2026-11-30', frequency: 'monthly', canWrite });
    check('VAT export switches between generation and GET filter ' + JSON.stringify(profile), canWrite ? !wizard.includes('method="get"') : wizard.includes('method="get"') && wizard.includes('Afficher la période'));
    const history = renderComponent('src/components/comptabilite/tva/tax-export-history.tsx', 'TaxExportHistory', { history: [{ id, period_start: '2026-11-01', period_end: '2026-11-30', frequency: 'monthly', status: 'generated', xml_path: 'synthetic.xml', csv_path: 'synthetic.csv', totals: {}, created_at: '2026-11-01' }] });
    check('Existing VAT XML and CSV downloads remain ' + JSON.stringify(profile), history.includes('/download?file=xml') && history.includes('/download?file=csv'));
  }
  profile = { role: 'manager', expired: false };
  check('VAT preserves stricter accounting role scope', load('src/app/comptabilite/tva/access.ts').canWriteVatWorkspace(workspace()) === false);
  check('SSR executed no mutation, storage or network', mutations === 0);
  const report = { success: true, assertions: results.length, scope: 'Real server pages and detail/table components rendered with React SSR; synthetic reads/auth/actions and Next Link boundary', network: false, projectSecretsLoaded: false, results };
  fs.writeFileSync(path.join(__dirname, 'readonly-ui-fixtures.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, assertions: results.length }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
