// Real service code against a deterministic, read-only API fixture. No env/network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const org = 'fixture-company';
const tables = {};
let calls = 0, failTable = null;
const cache = new Map();
function query(table) {
  let rows = [...(tables[table] || [])], start = 0, end = Infinity;
  const q = {
    select() { return q; },
    eq(key, value) { rows = rows.filter(r => r[key] === value); return q; },
    neq(key, value) { rows = rows.filter(r => r[key] !== value); return q; },
    is(key, value) { rows = rows.filter(r => (r[key] ?? null) === value); return q; },
    in(key, values) { rows = rows.filter(r => values.includes(r[key])); return q; },
    gte(key, value) { rows = rows.filter(r => r[key] >= value); return q; },
    lte(key, value) { rows = rows.filter(r => r[key] <= value); return q; },
    order() { return q; },
    range(from, to) { start = from; end = to; return q; },
    then(resolve) { calls++; return Promise.resolve({ data: failTable === table ? null : rows.slice(start, Math.min(end + 1, start + 37)), count: rows.length, error: failTable === table ? { message: 'Fixture unavailable' } : null }).then(resolve); },
  };
  return q;
}
function load(relative) {
  const file = path.join(root, relative);
  if (cache.has(file)) return cache.get(file);
  const moduleState = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module: moduleState, exports: moduleState.exports, Response, URLSearchParams, Intl, console, require(name) {
    if (name === '@/lib/auth') return { requireActiveWorkspace: async () => ({ organization: { id: org }, userId: 'fixture-admin', role: 'admin' }) };
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ from: query }) };
    if (name === '@/lib/listing') return load('src/lib/listing.ts');
    if (name === '@/lib/invoice-calculations') return load('src/lib/invoice-calculations.ts');
    return {};
  } }, { filename: file });
  cache.set(file, moduleState.exports);
  return moduleState.exports;
}
async function main() {
  let checks = 0;
  const check = (condition, name) => { assert.ok(condition, name); checks++; };
  const { readAllPages, pageRows, positivePage, csvResponse } = load('src/lib/listing.ts');
  const source = Array.from({ length: 1247 }, (_, id) => ({ id }));
  const complete = await readAllPages((from, to) => Promise.resolve({ data: source.slice(from, Math.min(to + 1, from + 37)), error: null }));
  check(complete.length === 1247 && complete.at(-1).id === 1246, 'Complete list survives API cap below requested batch');
  check(new Set(complete.map(r => r.id)).size === 1247, 'No duplication at API batch boundaries');
  const page = pageRows(source, 2, 25);
  check(page.rows[0].id === 25 && page.rows.at(-1).id === 49 && page.totalPages === 50, 'Pagination keeps full history after first 25 rows');
  check(pageRows(source, 999, 25).page === 50, 'Out-of-range page returns last existing page');
  check(positivePage(NaN) === 1 && positivePage(1.5) === 1 && positivePage(-1) === 1, 'Invalid pages normalize safely');
  await assert.rejects(() => readAllPages(() => Promise.resolve({ data: null, error: { message: 'Unavailable' } })), /Unavailable/); checks++;
  const csv = await csvResponse('fixture', ['Nom', 'Montant'], [['=1+1', 12], ['Texte "avec"\nretour', 3]]).text();
  check(csv.includes("'=1+1") && csv.includes('"Texte ""avec""\nretour"') && csv.includes(';"12"'), 'CSV preserves values and neutralizes formulas');

  const base = { organization_id: org, archived_at: null, transaction_date: '2026-10-31', created_at: '2026-10-31', account: { name: 'Banque', account_type: 'bank' }, third_party: { name: 'Client Essentiel', primary_type: 'customer' }, transaction_type: 'customer_payment', treasury_account_id: 'bank', reconciliation_status: 'unreconciled', label: 'Encaissement', reference: null };
  tables.treasury_transactions = Array.from({ length: 120 }, (_, i) => ({ ...base, id: 'tx-' + i, amount: 2, currency: 'MAD', direction: i % 2 ? 'out' : 'in', customer_payment_id: 'pay-' + i, customer_invoice_id: 'same-invoice' }));
  tables.treasury_transactions.push({ ...base, id: 'eur-in', amount: 100, currency: 'EUR', direction: 'in' }, { ...base, id: 'eur-out', amount: 60, currency: 'EUR', direction: 'out' }, { ...base, id: 'foreign', organization_id: 'other-company', amount: 99999, currency: 'MAD', direction: 'in' });
  tables.customer_payments = Array.from({ length: 120 }, (_, i) => ({ organization_id: org, id: 'pay-' + i, payment_method: i % 2 ? 'cash' : 'transfer' }));
  tables.customer_invoices = [{ organization_id: org, id: 'same-invoice', invoice_number: 'FAC-1' }];
  tables.accounting_entries = [{ organization_id: org, id: 'wrong-invoice-entry', source_document_type: 'customer_invoice', source_document_id: 'same-invoice', status: 'posted', entry_number: 'VE-1' }, ...Array.from({ length: 120 }, (_, i) => ({ organization_id: org, id: 'entry-' + i, source_document_type: 'customer_payment', source_document_id: 'pay-' + i, status: 'posted', entry_number: 'BQ-' + i }))];
  const treasury = load('src/lib/treasury.ts');
  const flow = await treasury.listTreasuryConsultationFlows({ page: 2, pageSize: 50 });
  check(flow.rows.length === 50 && flow.total === 122 && flow.totalPages === 3, 'Treasury pagination includes all 122 local rows');
  check(flow.summary.total_entries === 122 && flow.summary.total_in === 120 && flow.summary.total_out === 120, 'Summary covers all results and excludes foreign currency from MAD totals');
  check(flow.summary.currencyTotals.find(t => t.currency === 'EUR').net_flow === 40, 'Historic EUR stays separately summarized');
  check(flow.rows[0].accounting_entry_id === 'entry-50' && flow.rows[1].accounting_entry_id === 'entry-51', 'Payment transaction uses its own posting, never the shared invoice posting');
  const filtered = await treasury.listTreasuryConsultationFlows({ payment_method: 'bank_transfer', page: 2, pageSize: 25 });
  check(filtered.total === 60 && filtered.rows.length === 25 && filtered.summary.total_entries === 60, 'Legacy transfer normalized and payment filter applied before paging and totals');
  const posted = await treasury.listTreasuryConsultationFlows({ accounting_status: 'posted', page: 1, pageSize: 50 });
  check(posted.total === 120 && posted.summary.posted_count === 120, 'Accounting filter applies to entire data set');
  const exported = await treasury.listTreasuryConsultationFlows({}, true);
  check(exported.rows.length === 122, 'Treasury export contains every filtered row');
  const transactions = await treasury.listTreasuryTransactions();
  check(transactions.length === 122, 'Movements no longer stop at 100');

  tables.supplier_invoices = Array.from({ length: 127 }, (_, i) => ({ organization_id: org, archived_at: null, id: 'purchase-' + i, invoice_number: 'FF-' + i, supplier_invoice_number: 'EXT-' + i, supplier: { name: i % 2 ? 'Autre fournisseur' : 'Fournisseur Essentiel' }, invoice_date: '2026-10-31', total_ttc: 120, status: 'validated' }));
  const purchases = load('src/lib/purchases.ts');
  const supplier = await purchases.listSupplierInvoices({ query: 'Fournisseur Essentiel', page: 2 });
  check(supplier.total === 64 && supplier.rows.length === 25 && supplier.totalPages === 3, 'Purchase name search and pagination include every supplier result');
  check((await purchases.listSupplierInvoiceExportRows({})).length === 127, 'Purchase export passes API cap');
  failTable = 'supplier_invoices';
  await assert.rejects(() => purchases.listSupplierInvoices({}), /Fixture unavailable/); checks++;
  failTable = null;
  tables.customer_invoices = Array.from({ length: 129 }, (_, i) => ({ organization_id: org, archived_at: null, id: 'sale-' + i, invoice_number: 'FAC-' + i, customer: { name: i % 2 ? 'Autre client' : 'Client Essentiel' }, invoice_date: '2026-10-31', total_ttc: 240, status: 'validated' }));
  const sales = load('src/lib/invoices.ts');
  const salePage = await sales.listCustomerInvoices({ page: 2 });
  check(salePage.total === 129 && salePage.rows.length === 25 && salePage.rows[0].id === 'sale-25', 'Sales second page exposes invoices after first 25');
  const salesSearch = await sales.listCustomerInvoices({ query: 'Client Essentiel', page: 2 });
  check(salesSearch.total === 65 && salesSearch.rows.length === 25, 'Sales searches by customer across all API batches');
  check((await sales.listCustomerInvoiceExportRows()).length === 129, 'Sales export includes all rows beyond API cap');

  tables.customer_credit_notes = Array.from({ length: 137 }, (_, i) => ({ organization_id: org, archived_at: null, id: 'credit-' + i, credit_note_number: 'AV-' + i, customer_id: 'customer', total_ttc: 24, available_amount: 24, status: 'validated' }));
  const credits = load('src/lib/credit-notes.ts');
  check((await credits.listCustomerCreditNotes()).length === 137, 'Credit notes remain visible beyond 50 rows and API cap');
  check((await credits.listAvailableCreditNotes('customer')).length === 137, 'All available credit balances remain usable beyond 50 rows');
  const { calculateSupplierInvoiceLine } = load('src/lib/purchase-line-amounts.ts');
  const smallPurchase = calculateSupplierInvoiceLine({ quantity: 1.5, unit_price_ht: 0.03, discount_rate: 0, tax_rate: 20 });
  check(smallPurchase.subtotal_ht === 0.05 && smallPurchase.tax_amount === 0.01 && smallPurchase.total_ttc === 0.06, 'Purchase preview rounds fractional quantities before VAT like the saved document');
  const discountedPurchase = calculateSupplierInvoiceLine({ quantity: 3, unit_price_ht: 9.99, discount_rate: 12.5, tax_rate: 20 });
  check(discountedPurchase.subtotal_ht === 29.97 && discountedPurchase.discount_amount === 3.75 && discountedPurchase.tax_amount === 5.24 && discountedPurchase.total_ttc === 31.46, 'Purchase preview preserves gross HT and separately rounded discount');

  tables.accounting_entries = Array.from({ length: 1306 }, (_, i) => ({ id: 'journal-entry-' + i, organization_id: org, journal_id: 'journal', status: 'posted', entry_number: 'VE-' + i, entry_date: '2026-10-31', total_debit: 12, total_credit: 12 }));
  tables.accounting_entry_lines = tables.accounting_entries.flatMap((entry, i) => [{ id: 'debit-' + i, organization_id: org, entry_id: entry.id, account_id: i % 2 ? 'account-b' : 'account-a', account_code: '3421', line_number: 1, debit: 12, credit: 0 }, { id: 'credit-' + i, organization_id: org, entry_id: entry.id, account_id: 'account-revenue', account_code: '7124', line_number: 2, debit: 0, credit: 12 }]);
  tables.accounting_journals = [{ id: 'journal', code: 'VE', organization_id: org }];
  const accounting = load('src/lib/accounting.ts');
  const lastPage = await accounting.listAccountingJournalEntries('journal', { page: 27, pageSize: 50 });
  check(lastPage.total === 1306 && lastPage.entries.length === 6 && lastPage.lines.length === 12, 'Journal pages remain exhaustive beyond 1000 API rows');
  const journalExport = await accounting.listAccountingJournalExportRows('journal');
  check(journalExport.entries.length === 1306 && journalExport.lines.length === 2612, 'Journal export fetches every entry and every line');
  check(new Set(journalExport.lines.map(r => r.id)).size === 2612, 'Journal export never duplicates line batches');
  const journalStats = await accounting.listAccountingJournalsWithStats();
  check(journalStats[0].entries_count === 1306 && journalStats[0].total_debit === 15672 && journalStats[0].total_credit === 15672, 'Journal aggregate totals include the complete history');
  const accountFilter = await accounting.listAccountingJournalEntries('journal', { account_id: 'account-a' });
  check(accountFilter.total === 653 && accountFilter.totalPages === 14, 'Account filters scan matching lines beyond the API cap');
  const report = { date: new Date().toISOString(), checks, passed: true, apiFixtureCap: 37, networkRequests: 0, databaseMutations: 0, apiFixtureReads: calls, scope: 'Real service code, deterministic API fixtures; no credentials or production data' };
  const out = path.join(root, 'training/essential-fixes/20261031'); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'workflow-services.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
