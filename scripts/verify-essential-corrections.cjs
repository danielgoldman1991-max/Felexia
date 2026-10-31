/* eslint-disable @typescript-eslint/no-require-imports -- Explicit Node CommonJS integration-test entry point. */
// Authorized recette only. The private manifest, credentials and actor sessions stay outside Git.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifestPath = process.argv.find(x => x.startsWith('--manifest='))?.slice(11);
if (!manifestPath || !process.argv.includes('--execute-qa')) throw new Error('Explicit private manifest and --execute-qa are required. Run only after migrations and business setup.');
require('@next/env').loadEnvConfig(root);
const { createClient } = require('@supabase/supabase-js');
const { createActionRunner } = require('./essential-action-runner.cjs');
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!m.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !m.run?.startsWith('essential-final-') || !m.organizationId) throw new Error('Prepared fictitious recette company required');
const mailbox = m.authorizedMailbox;
if (typeof mailbox !== 'string' || !mailbox.includes('@')) throw new Error('Authorized test mailbox must be specified privately');
const [mailboxName, mailboxDomain] = mailbox.toLowerCase().split('@');
for (const role of ['admin', 'operator', 'viewer']) {
  const email = (m.users?.[role]?.email || '').toLowerCase();
  const prefix = mailboxName + '+recette'; const suffix = role + '@' + mailboxDomain;
  if (!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length, -suffix.length))) throw new Error('Only the authorized recette aliases may be used');
}
for (const name of ['customerId', 'supplierId', 'bankId', 'saleId', 'purchaseId']) if (!/^[0-9a-f-]{36}$/i.test(m.records?.[name] || '')) throw new Error('Complete base business setup before correction tests');
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!key || key.startsWith('sb_secret_')) throw new Error('Public project key required');
const dir = path.join(root, 'training/essential-fixes/20261031'); fs.mkdirSync(dir, { recursive: true });
const report = { date: new Date().toISOString(), run: m.run, phase: 'corrections', companyName: m.companyName, checks: [], diagnostics: [], operations: {} };
m.corrections ||= {};
const c = m.corrections;
const clients = {}; let actor = 'admin';
const runner = createActionRunner(() => clients[actor], report.diagnostics);
const today = new Date().toISOString().slice(0, 10);
function save() { fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n'); fs.writeFileSync(path.join(dir, 'company-corrections.json'), JSON.stringify(report, null, 2) + '\n'); }
function safeText(value) { return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').slice(0, 250); }
function check(name, passed, observed) { report.checks.push({ name, passed: Boolean(passed), ...(observed === undefined ? {} : { observed }) }); if (!passed) throw new Error('QA_CHECK_FAILED: ' + name); }
async function login(role) {
  actor = role;
  if (!clients[role]) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const signed = await db.auth.signInWithPassword({ email: m.users[role].email, password: m.users[role].password });
    check(role + ' public authentication', !signed.error); clients[role] = db;
  }
  const workspace = await runner.load('src/lib/auth.ts').getActiveWorkspace();
  check(role + ' company scope', workspace?.organization.id === m.organizationId && workspace?.organization.name === m.companyName);
  return clients[role];
}
async function read(query, name) { const r = await query; check(name + ' query', !r.error, r.error?.code); return r.data; }
async function action(file, name, payload, success = true) {
  const response = await runner.invoke(file, name, payload);
  const ok = typeof response.redirect === 'string'
    ? response.redirect.startsWith('/') && !/^\/(?:login|onboarding|abonnement|parametres\/abonnement)(?:[/?#]|$)/.test(response.redirect)
    : Boolean(response.result && typeof response.result === 'object' && !response.result.error && response.result.success !== false);
  check(actor + ' ' + name + (success ? '' : ' denied'), success ? ok : !ok, response.result?.error ? safeText(response.result.error) : undefined);
  return response;
}
const idFrom = r => (r.redirect || '').match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0] || r.result?.data?.id;
const line = (description, price, quantity = 1) => ({ id: crypto.randomUUID(), mode: 'free', description, quantity, unit_price_ht: price, discount_rate: 0, tax_rate: 20 });
const saleForm = (description, price = 10) => ({ customer_id: m.records.customerId, invoice_date: today, source_type: 'manual', notes: 'Recette fonctionnelle fictive : ' + description, lines: [line(description, price)] });
async function contacts() {
  await login('operator');
  if (!c.contactId) { c.contactId = idFrom(await action('src/lib/third-party-actions.ts', 'createThirdParty', { name: 'CLIENT RECETTE ARCHIVAGE RESTAURATION', type_customer: 'on', status: 'active', country: 'Maroc' })); save(); }
  check('temporary contact created', Boolean(c.contactId));
  await action('src/lib/third-party-actions.ts', 'archiveThirdParty', { id: c.contactId, returnTo: '/tiers/clients' });
  const archived = await runner.load('src/lib/third-parties.ts').listThirdParties({ type: 'customer', status: 'archived', limit: 100 });
  check('archived contact is discoverable', archived.rows.some(row => row.id === c.contactId));
  await action('src/lib/third-party-actions.ts', 'restoreThirdParty', { id: c.contactId });
  const restored = await read(clients.operator.from('third_parties').select('status,archived_at').eq('organization_id', m.organizationId).eq('id', c.contactId).single(), 'restored contact');
  check('contact restored without new identity', restored.status === 'active' && restored.archived_at === null);
  await login('viewer'); await action('src/lib/third-party-actions.ts', 'archiveThirdParty', { id: c.contactId }, false);
  await action('src/lib/third-party-actions.ts', 'restoreThirdParty', { id: c.contactId }, false);
  report.operations.contactArchiveRestore = true; save();
}
async function cancelledDraft() {
  await login('operator');
  if (!c.cancelledDraftId) { c.cancelledDraftId = idFrom(await action('src/lib/invoice-actions.ts', 'createCustomerInvoice', saleForm('Brouillon à annuler'))); save(); }
  let record = await read(clients.operator.from('customer_invoices').select('status,archived_at').eq('organization_id', m.organizationId).eq('id', c.cancelledDraftId).single(), 'correction draft');
  if (record.status !== 'cancelled') await action('src/lib/invoice-actions.ts', 'cancelCustomerInvoice', { id: c.cancelledDraftId });
  if (!record.archived_at) await action('src/lib/invoice-actions.ts', 'archiveCustomerInvoice', { id: c.cancelledDraftId });
  record = await read(clients.operator.from('customer_invoices').select('status,archived_at').eq('organization_id', m.organizationId).eq('id', c.cancelledDraftId).single(), 'cancelled archived draft');
  check('draft cancellation and archive remain traceable', record.status === 'cancelled' && Boolean(record.archived_at));
  report.operations.cancelledDraft = true; save();
}
async function creditNotes() {
  await login('operator');
  if (!c.openSaleId) { c.openSaleId = idFrom(await action('src/lib/invoice-actions.ts', 'createCustomerInvoice', saleForm('Facture ouverte pour recette avoir', 200))); save(); }
  let open = await read(clients.operator.from('customer_invoices').select('status').eq('organization_id', m.organizationId).eq('id', c.openSaleId).single(), 'open credit target');
  if (open.status === 'draft') await action('src/lib/invoice-actions.ts', 'validateCustomerInvoice', { id: c.openSaleId });
  const creditForm = { customer_id: m.records.customerId, source_invoice_id: c.openSaleId, source_type: 'invoice_partial', credit_note_date: today, reason: 'Correction commerciale fictive de recette', lines: [line('Avoir de recette', 10)] };
  if (!c.creditNoteId) { c.creditNoteId = idFrom(await action('src/lib/credit-note-actions.ts', 'createCustomerCreditNote', creditForm)); save(); }
  const creditFile = 'src/lib/credit-note-actions.ts';
  let credit = await read(clients.operator.from('customer_credit_notes').select('status,credit_note_number,total_ttc').eq('organization_id', m.organizationId).eq('id', c.creditNoteId).single(), 'created credit');
  if (credit.status === 'draft') {
    const number = credit.credit_note_number;
    await action(creditFile, 'updateCustomerCreditNote', { ...creditForm, id: c.creditNoteId, lines: [line('Avoir corrigé par opérateur', 20)] });
    credit = await read(clients.operator.from('customer_credit_notes').select('credit_note_number,total_ttc').eq('organization_id', m.organizationId).eq('id', c.creditNoteId).single(), 'edited credit');
    check('credit draft edit preserves number and recomputes 24 TTC', credit.credit_note_number === number && Number(credit.total_ttc) === 24);
    await action(creditFile, 'validateCustomerCreditNote', { id: c.creditNoteId });
  }
  if (!c.creditAllocationCorrected) {
    const applied = await read(clients.operator.from('customer_credit_note_applications').select('id').eq('organization_id', m.organizationId).eq('credit_note_id', c.creditNoteId).is('cancelled_at', null), 'current credit applications');
    if (!applied.length) await action(creditFile, 'applyCreditNoteToInvoices', { credit_note_id: c.creditNoteId, applications: [{ invoice_id: c.openSaleId, amount: 24 }] });
    const target = await read(clients.operator.from('customer_invoices').select('remaining_amount,credit_amount,paid_amount').eq('organization_id', m.organizationId).eq('id', c.openSaleId).single(), 'credited target');
    check('credit reduces open invoice to 216 without cash', Number(target.remaining_amount) === 216 && Number(target.credit_amount) === 24 && Number(target.paid_amount) === 0);
    const allocation = await read(clients.operator.from('customer_credit_note_applications').select('id').eq('organization_id', m.organizationId).eq('credit_note_id', c.creditNoteId).is('cancelled_at', null).single(), 'credit application to correct');
    await login('viewer'); await action(creditFile, 'unapplyCreditNoteFromInvoice', { id: allocation.id }, false);
    await login('operator'); await action(creditFile, 'unapplyCreditNoteFromInvoice', { id: allocation.id });
    const restored = await read(clients.operator.from('customer_invoices').select('remaining_amount,credit_amount,paid_amount').eq('organization_id', m.organizationId).eq('id', c.openSaleId).single(), 'restored credit target');
    check('removal restores 240 and leaves cash unchanged', Number(restored.remaining_amount) === 240 && Number(restored.credit_amount) === 0 && Number(restored.paid_amount) === 0);
    c.creditAllocationCorrected = true; save();
  }
  await login('viewer'); await action(creditFile, 'updateCustomerCreditNote', { ...creditForm, id: c.creditNoteId }, false);
  await action(creditFile, 'postCustomerCreditNote', { id: c.creditNoteId }, false);
  await login('operator'); await action(creditFile, 'postCustomerCreditNote', { id: c.creditNoteId }, false);
  await login('admin'); await action(creditFile, 'postCustomerCreditNote', { id: c.creditNoteId });
  const posted = await read(clients.admin.from('accounting_entries').select('id,status,total_debit,total_credit').eq('organization_id', m.organizationId).eq('source_document_type', 'customer_credit_note').eq('source_document_id', c.creditNoteId).neq('status', 'cancelled'), 'credit posting');
  check('credit posting is unique and balanced at 24', posted.length === 1 && posted[0].status === 'posted' && Number(posted[0].total_debit) === 24 && Number(posted[0].total_credit) === 24);
  await action(creditFile, 'postCustomerCreditNote', { id: c.creditNoteId });
  const repeated = await read(clients.admin.from('accounting_entries').select('id').eq('organization_id', m.organizationId).eq('source_document_type', 'customer_credit_note').eq('source_document_id', c.creditNoteId).neq('status', 'cancelled'), 'idempotent credit posting');
  check('repeated credit posting creates no duplicate entry', repeated.length === 1 && repeated[0].id === posted[0].id);
  await action(creditFile, 'cancelCustomerCreditNote', { id: c.creditNoteId }, false);
  await login('operator');
  const current = await read(clients.operator.from('customer_credit_note_applications').select('id').eq('organization_id', m.organizationId).eq('credit_note_id', c.creditNoteId).is('cancelled_at', null), 'posted credit current allocations');
  if (!current.length) await action(creditFile, 'applyCreditNoteToInvoices', { credit_note_id: c.creditNoteId, applications: [{ invoice_id: c.openSaleId, amount: 24 }] });
  const postedApplication = await read(clients.operator.from('customer_credit_note_applications').select('id').eq('organization_id', m.organizationId).eq('credit_note_id', c.creditNoteId).is('cancelled_at', null).single(), 'posted credit operator allocation');
  await action(creditFile, 'unapplyCreditNoteFromInvoice', { id: postedApplication.id });
  const restoredAfterPosting = await read(clients.operator.from('customer_invoices').select('remaining_amount,credit_amount,paid_amount').eq('organization_id', m.organizationId).eq('id', c.openSaleId).single(), 'posted credit target restoration');
  const unchangedPosting = await read(clients.operator.from('accounting_entries').select('id,status,total_debit,total_credit').eq('organization_id', m.organizationId).eq('source_document_type', 'customer_credit_note').eq('source_document_id', c.creditNoteId).neq('status', 'cancelled'), 'posting after operator allocation correction');
  check('operator may reallocate posted credit without changing cash or journal', Number(restoredAfterPosting.remaining_amount) === 240 && Number(restoredAfterPosting.credit_amount) === 0 && Number(restoredAfterPosting.paid_amount) === 0 && unchangedPosting.length === 1 && unchangedPosting[0].id === posted[0].id && Number(unchangedPosting[0].total_debit) === 24 && Number(unchangedPosting[0].total_credit) === 24 && unchangedPosting[0].status === 'posted');
  await action(creditFile, 'cancelCustomerCreditNote', { id: c.creditNoteId }, false);
  c.creditEntryId = posted[0].id; report.operations.creditNote = { totalTtc: 24, available: 24, targetRemaining: 240, accountingBalanced: true, postedCancellationDenied: true, operatorMayReallocatePosted: true }; save();
}
async function paginationAndExports() {
  await login('operator'); c.paginationDrafts ||= [];
  while (c.paginationDrafts.length < 26) { const i = c.paginationDrafts.length + 1; c.paginationDrafts.push(idFrom(await action('src/lib/invoice-actions.ts', 'createCustomerInvoice', saleForm('Pagination recette ' + i, 1)))); save(); }
  check('26 synthetic pagination invoices have distinct identities', new Set(c.paginationDrafts).size === 26 && c.paginationDrafts.every(Boolean));
  await login('viewer');
  const service = runner.load('src/lib/invoices.ts');
  const first = await service.listCustomerInvoices({ page: 1 });
  const second = await service.listCustomerInvoices({ page: 2 });
  check('second sales page is available to viewer', first.total >= 28 && first.rows.length === 25 && second.rows.length > 0 && first.totalPages >= 2);
  check('sales pages do not duplicate records', !second.rows.some(row => first.rows.some(prior => prior.id === row.id)));
  const handler = runner.load('src/app/api/exports/[kind]/route.ts');
  const recordCount = text => { let quoted = false, count = 0; for (let i = 0; i < text.length; i++) { if (text[i] === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; } else if (text[i] === '\n' && !quoted) count++; } return count; };
  const expectedSales = await clients.viewer.from('customer_invoices').select('id', { count: 'exact', head: true }).eq('organization_id', m.organizationId).is('archived_at', null);
  check('sales export expected count query', !expectedSales.error);
  const outputs = {};
  for (const kind of ['sales', 'purchases', 'contacts', 'treasury', 'treasury-ledger']) {
    const response = await handler.GET(new Request('https://www.felexia.pro/api/exports/' + kind), { params: Promise.resolve({ kind }) });
    check(kind + ' export available to read-only user', response.status === 200 && response.headers.get('content-type')?.includes('text/csv'));
    const text = await response.text(); const count = recordCount(text); outputs[kind] = count;
    if (kind === 'sales') check('CSV contains every nonarchived sales invoice beyond first page', count === expectedSales.count);
  }
  report.operations.pagination = { distinctDraftsCreated: 26, salesRows: first.total, pages: first.totalPages, exportDataRows: outputs }; save();
}
async function numbering() {
  await login('admin');
  const period = runner.load('src/lib/numbering-model.ts').currentNumberingPeriod();
  const loader = runner.load('src/lib/numbering.ts');
  const data = await loader.getNumberingSettings(period); const counter = data.counters.find(row => row.key === 'customer_invoice');
  check('admin can read live invoice counter', data.migrationReady && Boolean(counter));
  const original = counter.nextNumber;
  const payload = { period, counterKey: counter.key, expectedRevision: counter.revision, nextNumber: original + 1, reason: 'Recette trois profils : correction du prochain numéro' };
  const file = 'src/lib/actions/numbering.ts';
  const raised = await action(file, 'correctNumberingCounterAction', payload);
  try { check('counter correction is confirmed', raised.result?.counter?.nextNumber === original + 1); }
  finally {
    const current = (await loader.getNumberingSettings(period)).counters.find(row => row.key === counter.key);
    check('no issued document consumes the temporary corrected counter', current.minNextNumber <= original);
    await action(file, 'correctNumberingCounterAction', { ...payload, expectedRevision: current.revision, nextNumber: original, reason: 'Fin de recette : restauration du prochain numéro initial' });
  }
  const restored = (await loader.getNumberingSettings(period)).counters.find(row => row.key === counter.key);
  check('invoice counter restored to its original value', restored.nextNumber === original);
  await login('operator'); await action(file, 'correctNumberingCounterAction', { ...payload, expectedRevision: restored.revision }, false);
  await login('viewer'); await action(file, 'correctNumberingCounterAction', { ...payload, expectedRevision: restored.revision }, false);
  report.operations.numbering = { corrected: true, restored: true, originalNextNumber: original }; save();
}
async function manualJournalAndServices() {
  await login('admin');
  const accounts = await read(clients.admin.from('accounting_accounts').select('id,code,name').eq('organization_id', m.organizationId).in('code', ['6588', '4488']), 'manual entry accounts');
  const journals = await read(clients.admin.from('accounting_journals').select('id,code').eq('organization_id', m.organizationId).eq('code', 'OD'), 'manual entry journal');
  check('manual journal defaults are ready', accounts.length === 2 && journals.length === 1);
  const payload = { journal_id: journals[0].id, entry_date: today, label: 'Écriture manuelle de recette fictive', reference: 'RECETTE-OD', lines: [{ account_id: accounts.find(a => a.code === '6588').id, debit: 5, credit: 0, label: 'Charge fictive' }, { account_id: accounts.find(a => a.code === '4488').id, debit: 0, credit: 5, label: 'Contrepartie fictive' }] };
  if (!c.manualEntryId) { c.manualEntryId = idFrom(await action('src/lib/accounting-actions.ts', 'createAccountingEntry', payload)); save(); }
  const entry = await read(clients.admin.from('accounting_entries').select('status,total_debit,total_credit').eq('organization_id', m.organizationId).eq('id', c.manualEntryId).single(), 'manual draft');
  if (entry.status === 'draft') await action('src/lib/accounting-actions.ts', 'postAccountingEntry', { id: c.manualEntryId });
  await login('operator'); await action('src/lib/accounting-actions.ts', 'createAccountingEntry', payload, false);
  await login('viewer'); await action('src/lib/accounting-actions.ts', 'createAccountingEntry', payload, false);
  const consultation = await runner.load('src/lib/treasury.ts').listTreasuryConsultationFlows({});
  const internalTransfers = m.treasuryTest?.transfersCompleted ? 20 : 0;
  check('treasury totals retain base flows plus audited internal transfers and net120', consultation.summary.total_in === 240 + internalTransfers && consultation.summary.total_out === 120 + internalTransfers && consultation.summary.net_flow === 120);
  const paymentEntries = await read(clients.viewer.from('accounting_entries').select('id,source_document_type,source_document_id').eq('organization_id', m.organizationId).in('source_document_type', ['customer_payment', 'supplier_payment']).eq('status', 'posted'), 'payment journal sources');
  const paymentRows = consultation.rows.filter(row => row.customer_payment_id || row.supplier_payment_id);
  check('treasury payments link their own posting instead of the invoice posting', paymentRows.length === 3 && paymentRows.every(row => paymentEntries.some(entry => entry.id === row.accounting_entry_id && entry.source_document_id === (row.customer_payment_id || row.supplier_payment_id) && entry.source_document_type === (row.customer_payment_id ? 'customer_payment' : 'supplier_payment'))));
  const accounting = runner.load('src/lib/accounting.ts');
  const allJournals = await accounting.listAccountingJournalsWithStats();
  check('all journal aggregates remain balanced', allJournals.every(journal => Math.abs(journal.total_debit - journal.total_credit) < 0.005));
  for (const journal of allJournals) { const output = await accounting.listAccountingJournalExportRows(journal.id); check('journal export matches entry count ' + journal.code, output.entries.length === journal.entries_count); }
  report.operations.manualJournal = { posted: true, debit: 5, credit: 5 }; report.operations.treasury = { in: 240 + internalTransfers, out: 120 + internalTransfers, net: 120, internalTransfersPerDirection: internalTransfers }; save();
}
async function main() {
  for (const role of ['admin', 'operator', 'viewer']) await login(role);
  await contacts(); await cancelledDraft(); await creditNotes(); await paginationAndExports(); await numbering(); await manualJournalAndServices();
  report.success = report.checks.every(item => item.passed); report.completedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, report: path.join(dir, 'company-corrections.json') }));
}
main().catch(error => { report.success = false; report.error = safeText(error.message); save(); console.error(JSON.stringify({ success: false, checks: report.checks.length, error: report.error })); process.exitCode = 1; });
