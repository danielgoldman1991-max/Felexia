/* eslint-disable @typescript-eslint/no-require-imports -- Scoped read-only recette verification. */
// Run AFTER business, treasury, corrections, supplier-credit and posting corrections.openSaleId.
// No server action, RPC, service key or business mutation is used in this reader.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifestPath = process.argv.find(arg => arg.startsWith('--manifest='))?.slice(11);
if (!manifestPath || !process.argv.includes('--read-only')) throw new Error('Explicit private QA manifest and --read-only required');
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const uuid = value => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value || '');
if (!m.run?.startsWith('essential-final-') || !m.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !uuid(m.organizationId)) throw new Error('Prepared fictitious recette company required');
for (const id of [m.records?.customerId, m.records?.supplierId, m.records?.bankId, m.records?.saleId, m.records?.purchaseId, m.corrections?.openSaleId, m.corrections?.creditNoteId, m.corrections?.manualEntryId, m.supplierCorrections?.invoiceId, m.supplierCorrections?.creditId, m.supplierCorrections?.paymentId]) if (!uuid(id)) throw new Error('Complete the authorized QA operations before running the final reader');
if (!m.treasuryTest?.transfersCompleted || !uuid(m.treasuryTest.cashAccountId) || !uuid(m.treasuryTest.manualTransactionId) || m.treasuryTest.transferGroupIds?.length !== 2 || m.treasuryTest.transactionIds?.length !== 4 || ![...m.treasuryTest.transferGroupIds, ...m.treasuryTest.transactionIds].every(uuid)) throw new Error('Complete the authorized treasury transfer round trip before running the final reader');
const mailbox = String(m.authorizedMailbox || '').toLowerCase().split('@');
if (mailbox.length !== 2) throw new Error('Authorized QA mailbox required');
for (const role of ['admin', 'operator', 'viewer']) {
  const address = String(m.users?.[role]?.email || '').toLowerCase(); const prefix = mailbox[0] + '+recette'; const suffix = role + '@' + mailbox[1];
  if (!address.startsWith(prefix) || !address.endsWith(suffix) || !/^\d+$/.test(address.slice(prefix.length, -suffix.length))) throw new Error('Only the authorized QA user aliases may be used');
}
require('@next/env').loadEnvConfig(root);
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || key.startsWith('sb_secret_') || key === process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Public project configuration required');
const report = { date: new Date().toISOString(), run: m.run, companyName: m.companyName, scope: 'Final read-only checks of the explicitly authorized fictitious QA company', businessWrites: 0, checks: [], pendingSources: [] };
const cents = value => Math.round(Number(value || 0) * 100);
const sum = (rows, field) => rows.reduce((total, row) => total + cents(row[field]), 0);
const active = row => !row.archived_at && !['draft', 'cancelled'].includes(row.status);
const check = (name, passed, observed) => report.checks.push({ name, passed: Boolean(passed), ...(observed === undefined ? {} : { observed }) });
const same = (name, actual, expected) => check(name, actual === expected, { actual, expected });
const tables = {
  organization_members: 'id,user_id,role_id,status', roles: 'id,name',
  customer_invoices: 'id,customer_id,status,archived_at,subtotal_ht,discount_total,tax_total,total_ttc,paid_amount,credit_amount,remaining_amount',
  customer_invoice_lines: 'id,invoice_id,quantity,unit_price_ht,discount_rate,tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc',
  supplier_invoices: 'id,supplier_id,status,archived_at,subtotal_ht,discount_total,tax_total,total_ttc,paid_amount,credit_amount,remaining_amount',
  supplier_invoice_lines: 'id,invoice_id,quantity,unit_price_ht,discount_rate,tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc',
  customer_credit_notes: 'id,customer_id,status,archived_at,subtotal_ht,discount_total,tax_total,total_ttc,applied_amount,available_amount',
  customer_credit_note_lines: 'id,credit_note_id,quantity,unit_price_ht,discount_rate,tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc',
  customer_credit_note_applications: 'id,credit_note_id,invoice_id,customer_id,amount,cancelled_at',
  supplier_credit_notes: 'id,supplier_id,status,archived_at,subtotal_ht,discount_total,tax_total,total_ttc,applied_amount,available_amount',
  supplier_credit_note_lines: 'id,credit_note_id,quantity,unit_price_ht,discount_rate,tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc',
  supplier_credit_note_applications: 'id,credit_note_id,invoice_id,supplier_id,amount,cancelled_at',
  customer_payments: 'id,third_party_id,treasury_account_id,status,archived_at,amount,allocated_amount,available_amount',
  customer_payment_allocations: 'id,payment_id,invoice_id,amount,cancelled_at',
  supplier_payments: 'id,supplier_id,treasury_account_id,status,archived_at,amount,allocated_amount,available_amount',
  supplier_payment_allocations: 'id,payment_id,invoice_id,amount,cancelled_at',
  treasury_accounts: 'id,organization_id,account_type,currency,opening_balance,current_balance,archived_at',
  treasury_transactions: 'id,organization_id,treasury_account_id,transaction_type,direction,amount,currency,transfer_group_id,idempotency_key,third_party_id,customer_payment_id,supplier_payment_id,customer_invoice_id,supplier_invoice_id,archived_at',
  accounting_entries: 'id,journal_id,status,total_debit,total_credit,source_document_type,source_document_id',
  accounting_entry_lines: 'id,entry_id,account_id,debit,credit', accounting_accounts: 'id,code', accounting_journals: 'id,code',
};
async function all(db, table, fields) {
  const rows = []; for (;;) {
    const response = await db.from(table).select(fields).eq('organization_id', m.organizationId).order('id').range(rows.length, rows.length + 499);
    if (response.error) throw new Error('Read failed: ' + table + ' [' + response.error.code + ']');
    rows.push(...response.data); if (response.data.length < 500) return rows;
  }
}
const fingerprint = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
function amounts(line, grossSubtotal) {
  const gross = Math.round(Math.round(Number(line.quantity) * 1000) * cents(line.unit_price_ht) / 1000);
  const discount = Math.round(gross * Math.round(Number(line.discount_rate || 0) * 100) / 10000); const net = gross - discount;
  const vat = Math.round(net * Math.round(Number(line.tax_rate || 0) * 100) / 10000);
  return [grossSubtotal ? gross : net, discount, vat, net + vat];
}
function verifyDocuments(data, table, lineTable, parentKey, grossSubtotal = false) {
  for (const document of data[table]) {
    const lines = data[lineTable].filter(line => line[parentKey] === document.id); const calculated = [0, 0, 0, 0];
    for (const line of lines) {
      const expected = amounts(line, grossSubtotal); const observed = ['subtotal_ht', 'discount_amount', 'tax_amount', 'total_ttc'].map(field => cents(line[field]));
      check(table + ' line calculations', expected.every((value, i) => value === observed[i])); expected.forEach((value, i) => { calculated[i] += value; });
    }
    const observed = ['subtotal_ht', 'discount_total', 'tax_total', 'total_ttc'].map(field => cents(document[field]));
    check(table + ' header matches line totals', lines.length > 0 && calculated.every((value, i) => value === observed[i]));
  }
}
function verifySettlements(data, prefix) {
  const payments = data[prefix + '_payments']; const invoices = data[prefix + '_invoices']; const notes = data[prefix + '_credit_notes'];
  const cash = data[prefix + '_payment_allocations'].filter(row => !row.cancelled_at && active(payments.find(payment => payment.id === row.payment_id) || { status: 'cancelled' }));
  const credits = data[prefix + '_credit_note_applications'].filter(row => !row.cancelled_at);
  for (const allocation of [...cash, ...credits]) check(prefix + ' allocation has scoped invoice', invoices.some(invoice => invoice.id === allocation.invoice_id));
  for (const allocation of cash) { const invoice = invoices.find(row => row.id === allocation.invoice_id); const payment = payments.find(row => row.id === allocation.payment_id); check(prefix + ' cash allocation preserves party identity', invoice && payment && invoice[prefix + '_id'] === payment[prefix === 'customer' ? 'third_party_id' : 'supplier_id']); }
  for (const allocation of credits) { const invoice = invoices.find(row => row.id === allocation.invoice_id); const note = notes.find(row => row.id === allocation.credit_note_id); check(prefix + ' credit allocation preserves party identity', invoice && note && invoice[prefix + '_id'] === note[prefix + '_id']); }
  for (const invoice of invoices.filter(active)) {
    const paid = sum(cash.filter(row => row.invoice_id === invoice.id), 'amount'); const credited = sum(credits.filter(row => row.invoice_id === invoice.id), 'amount');
    same(prefix + ' cash is actual payment allocations', cents(invoice.paid_amount), paid); same(prefix + ' credit is actual credit allocations', cents(invoice.credit_amount), credited);
    same(prefix + ' invoice outstanding balance', cents(invoice.remaining_amount), cents(invoice.total_ttc) - paid - credited);
  }
  for (const payment of payments.filter(active)) {
    const applied = sum(cash.filter(row => row.payment_id === payment.id), 'amount'); same(prefix + ' payment allocated balance', cents(payment.allocated_amount), applied); same(prefix + ' payment available balance', cents(payment.available_amount), cents(payment.amount) - applied);
  }
  for (const note of notes.filter(active)) {
    const applied = sum(credits.filter(row => row.credit_note_id === note.id), 'amount'); same(prefix + ' credit allocated balance', cents(note.applied_amount), applied); same(prefix + ' credit available balance', cents(note.available_amount), cents(note.total_ttc) - applied);
  }
  return sum(invoices.filter(active), 'remaining_amount') - sum(notes.filter(active), 'available_amount') - sum(payments.filter(active), 'available_amount');
}
async function main() {
  let data;
  for (const role of ['admin', 'operator', 'viewer']) {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const login = await db.auth.signInWithPassword({ email: m.users[role].email, password: m.users[role].password });
    if (login.error) throw new Error('Authentication failed: ' + role + ' [' + login.error.code + ']');
    const company = await db.from('organizations').select('id,name').eq('id', m.organizationId).single();
    if (company.error || company.data.name !== m.companyName) throw new Error('QA company scope mismatch');
    const snapshot = Object.fromEntries(await Promise.all(Object.entries(tables).map(async ([table, fields]) => [table, await all(db, table, fields)])));
    if (!data) data = snapshot;
    else for (const table of Object.keys(tables)) same(role + ' reads the same scoped ' + table, fingerprint(snapshot[table]), fingerprint(data[table]));
  }
  const members = data.organization_members.filter(row => row.status === 'active'); same('exactly three active team users', members.length, 3);
  check('three expected role identities', ['admin', 'operator', 'viewer'].every(role => members.some(member => member.user_id === m.users[role].id && (role === 'admin' ? ['admin', 'owner'] : [role]).includes(data.roles.find(item => item.id === member.role_id)?.name))));
  verifyDocuments(data, 'customer_invoices', 'customer_invoice_lines', 'invoice_id'); verifyDocuments(data, 'supplier_invoices', 'supplier_invoice_lines', 'invoice_id', true);
  verifyDocuments(data, 'customer_credit_notes', 'customer_credit_note_lines', 'credit_note_id'); verifyDocuments(data, 'supplier_credit_notes', 'supplier_credit_note_lines', 'credit_note_id');
  const customerNet = verifySettlements(data, 'customer'); const supplierNet = verifySettlements(data, 'supplier');
  const posted = data.accounting_entries.filter(entry => entry.status === 'posted'); const entryIds = new Set(posted.map(entry => entry.id)); const postedLines = data.accounting_entry_lines.filter(line => entryIds.has(line.entry_id));
  const sources = new Set(); for (const entry of posted) {
    const lines = postedLines.filter(line => line.entry_id === entry.id); same('posted entry is balanced', sum(lines, 'debit'), sum(lines, 'credit')); same('entry debit matches its lines', cents(entry.total_debit), sum(lines, 'debit')); same('entry credit matches its lines', cents(entry.total_credit), sum(lines, 'credit'));
    check('posted entry has complete lines', lines.length >= 2);
    if (entry.source_document_id) { const source = entry.source_document_type + ':' + entry.source_document_id; check('active source is posted once', !sources.has(source)); sources.add(source); }
  }
  for (const [type, table, field] of [['customer_invoice', 'customer_invoices', 'total_ttc'], ['supplier_invoice', 'supplier_invoices', 'total_ttc'], ['customer_credit_note', 'customer_credit_notes', 'total_ttc'], ['supplier_credit_note', 'supplier_credit_notes', 'total_ttc'], ['customer_payment', 'customer_payments', 'amount'], ['supplier_payment', 'supplier_payments', 'amount']]) for (const source of data[table].filter(active)) {
    const entries = posted.filter(entry => entry.source_document_type === type && entry.source_document_id === source.id);
    if (entries.length === 0) report.pendingSources.push({ type, id: source.id, amount: cents(source[field]) / 100 });
    else same('posted source amount matches ' + type, cents(entries[0].total_debit), cents(source[field]));
  }
  same('all active operating sources have been posted', report.pendingSources.length, 0);
  const ledger = code => { const ids = new Set(data.accounting_accounts.filter(account => account.code === code).map(account => account.id)); return postedLines.filter(line => ids.has(line.account_id)).reduce((total, line) => total + cents(line.debit) - cents(line.credit), 0); };
  same('customer ledger reconciles commercial receivable less available credits', ledger('3421'), customerNet); same('supplier ledger reconciles commercial payable less available credits', -ledger('4411'), supplierNet);
  const movements = data.treasury_transactions.filter(row => !row.archived_at); let cashIn = 0; let cashOut = 0;
  for (const account of data.treasury_accounts.filter(row => !row.archived_at)) { const own = movements.filter(row => row.treasury_account_id === account.id); const net = sum(own.filter(row => row.direction === 'in'), 'amount') - sum(own.filter(row => row.direction === 'out'), 'amount'); same('bank account reconciles its movements', cents(account.current_balance), cents(account.opening_balance) + net); same('essential bank currency', account.currency, 'MAD'); }
  for (const row of movements) { if (row.direction === 'in') cashIn += cents(row.amount); else cashOut += cents(row.amount); same('movement currency', row.currency, 'MAD'); }
  const paymentMovements = movements.filter(row => row.customer_payment_id || row.supplier_payment_id);
  const internalMovements = movements.filter(row => row.transfer_group_id || ['transfer_in', 'transfer_out'].includes(row.transaction_type));
  same('four real payment movements and no cash from credit notes', paymentMovements.length, 4);
  same('four internal treasury movements retained', internalMovements.length, 4); same('only payment and internal-transfer movements are active', movements.length, paymentMovements.length + internalMovements.length);
  check('transfer movement audit identities preserved', internalMovements.every(row => m.treasuryTest.transactionIds.includes(row.id)) && new Set(internalMovements.map(row => row.id)).size === 4);
  const cashAccount = data.treasury_accounts.find(row => row.id === m.treasuryTest.cashAccountId);
  check('cash account audit identity preserved', cashAccount?.account_type === 'cash' && cashAccount.organization_id === m.organizationId);
  same('cash account ends at zero MAD', cents(cashAccount?.current_balance), 0); same('cash currency remains MAD', cashAccount?.currency, 'MAD');
  check('cash archive remains traceable', Boolean(m.treasuryTest.cashArchived && cashAccount?.archived_at));
  const manual = data.treasury_transactions.find(row => row.id === m.treasuryTest.manualTransactionId); check('temporary manual movement remains archived in the audit trail', Boolean(manual?.archived_at));
  const transferGroups = [...new Set(internalMovements.map(row => row.transfer_group_id))]; same('exactly two internal transfer groups', transferGroups.length, 2);
  for (const group of transferGroups) {
    const pair = internalMovements.filter(row => row.transfer_group_id === group); const incoming = pair.find(row => row.direction === 'in'); const outgoing = pair.find(row => row.direction === 'out');
    check('transfer group audit identity preserved', uuid(group) && m.treasuryTest.transferGroupIds.includes(group)); same('each transfer retains both legs', pair.length, 2);
    check('each transfer has incoming and outgoing legs', Boolean(incoming && outgoing));
    if (incoming && outgoing) {
      same('transfer legs carry equal amounts', cents(incoming.amount), cents(outgoing.amount)); same('each test transfer equals10 MAD', cents(incoming.amount), 1000);
      check('transfer legs stay within the same company and currency', pair.every(row => row.organization_id === m.organizationId && row.currency === 'MAD'));
      check('transfer legs retain the correct operation types', incoming.transaction_type === 'transfer_in' && outgoing.transaction_type === 'transfer_out');
      check('transfer crosses bank and cash accounts', incoming.treasury_account_id !== outgoing.treasury_account_id && [incoming.treasury_account_id, outgoing.treasury_account_id].every(id => [m.records.bankId, m.treasuryTest.cashAccountId].includes(id)));
      check('internal transfers are independent of commercial payments', pair.every(row => !row.customer_payment_id && !row.supplier_payment_id && !row.third_party_id));
    }
  }
  for (const id of [m.records.bankId, m.treasuryTest.cashAccountId]) { const own = internalMovements.filter(row => row.treasury_account_id === id); same('round-trip transfer restores the original account balance', sum(own.filter(row => row.direction === 'in'), 'amount') - sum(own.filter(row => row.direction === 'out'), 'amount'), 0); }
  const internalIn = sum(internalMovements.filter(row => row.direction === 'in'), 'amount'); const internalOut = sum(internalMovements.filter(row => row.direction === 'out'), 'amount'); same('internal transfer inflows total20 MAD', internalIn, 2000); same('internal transfer outflows total20 MAD', internalOut, 2000);
  const customerReceipts = sum(paymentMovements.filter(row => row.customer_payment_id), 'amount'); const supplierPayments = sum(paymentMovements.filter(row => row.supplier_payment_id), 'amount');
  const bank = data.treasury_accounts.find(row => row.id === m.records.bankId); same('bank GL reconciles the test bank', ledger('5141'), cents(bank.current_balance));
  report.sourceFlows = [];
  for (const prefix of ['customer', 'supplier']) for (const payment of data[prefix + '_payments'].filter(active)) {
    const linked = movements.filter(row => row[prefix + '_payment_id'] === payment.id); same(prefix + ' payment produces exactly one cash movement', linked.length, 1);
    if (linked[0]) {
      const flow = linked[0]; const sourceEntry = posted.find(entry => entry.source_document_type === prefix + '_payment' && entry.source_document_id === payment.id);
      same(prefix + ' cash movement matches actual payment', cents(flow.amount), cents(payment.amount)); same(prefix + ' flow direction', flow.direction, prefix === 'customer' ? 'in' : 'out'); same(prefix + ' flow type', flow.transaction_type, prefix + '_payment');
      same(prefix + ' flow remains on its own treasury account', flow.treasury_account_id, payment.treasury_account_id); check(prefix + ' flow is linked to its own accounting source', Boolean(sourceEntry));
      if (flow.third_party_id) same(prefix + ' flow preserves party identity', flow.third_party_id, payment[prefix === 'customer' ? 'third_party_id' : 'supplier_id']);
      if (flow[prefix + '_invoice_id']) check(prefix + ' optional invoice reference stays scoped', data[prefix + '_invoices'].some(invoice => invoice.id === flow[prefix + '_invoice_id']));
      report.sourceFlows.push({ type: prefix + '_payment', paymentId: payment.id, transactionId: flow.id, accountingEntryId: sourceEntry?.id });
    }
  }
  same('final posted entry count', posted.length, 11); same('final total journal debits', sum(posted, 'total_debit'), 122900); same('final total journal credits', sum(posted, 'total_credit'), 122900);
  report.journals = [];
  for (const [code, count, total] of [['VE', 3, 50400], ['AC', 3, 26400], ['BQ', 4, 45600], ['OD', 1, 500]]) {
    const ids = new Set(data.accounting_journals.filter(journal => journal.code === code).map(journal => journal.id)); const own = posted.filter(entry => ids.has(entry.journal_id));
    same(code + ' final entry count', own.length, count); same(code + ' final journal debit', sum(own, 'total_debit'), total); same(code + ' final journal credit', sum(own, 'total_credit'), total);
    report.journals.push({ code, entries: own.length, debit: sum(own, 'total_debit') / 100, credit: sum(own, 'total_credit') / 100 });
  }
  same('final bank balance MAD', cents(bank.current_balance), 2400); same('final gross treasury inflows MAD', cashIn, 26000); same('final gross treasury outflows MAD', cashOut, 23600); same('actual customer collections MAD', customerReceipts, 24000); same('actual supplier payments MAD', supplierPayments, 21600); same('final net customer receivable MAD', customerNet, 21600); same('final net supplier payable MAD', supplierNet, 0);
  report.financial = { currency: 'MAD', bank: cents(bank.current_balance) / 100, cash: cents(cashAccount.current_balance) / 100, grossTreasuryIn: cashIn / 100, grossTreasuryOut: cashOut / 100, customerReceipts: customerReceipts / 100, supplierPayments: supplierPayments / 100, internalIn: internalIn / 100, internalOut: internalOut / 100, customerNet: customerNet / 100, supplierNet: supplierNet / 100, postedEntries: posted.length, totalDebit: sum(posted, 'total_debit') / 100, totalCredit: sum(posted, 'total_credit') / 100 };
}
main().catch(error => { report.error = String(error.message).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'); }).finally(() => {
  report.success = !report.error && report.checks.every(item => item.passed); const output = path.join(root, 'training/essential-fixes/20261031/company-final-readonly.json'); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, failed: report.checks.filter(item => !item.passed), financial: report.financial, pendingSources: report.pendingSources, error: report.error, report: output })); if (!report.success) process.exitCode = 1;
});
