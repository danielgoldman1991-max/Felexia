import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  BankStatementImportRecord,
  BankStatementLineRecord,
  ReconciliationSuggestion,
  TreasuryAccountRecord,
  TreasuryCounters,
  TreasuryConsultationFilters,
  TreasuryConsultationRow,
  TreasuryConsultationSummary,
  TreasuryTransactionDirection,
  TreasuryTransactionRecord,
  TreasuryTransactionType,
} from "@/lib/treasury-types";

const ACCOUNT_SELECT = "id, organization_id, name, code, account_type, bank_name, agency_name, rib, iban, swift, account_number, currency, opening_balance, current_balance, opening_balance_date, is_default, status, notes, created_by, created_at, updated_at, archived_at";
const TRANSACTION_SELECT = "id, organization_id, treasury_account_id, transaction_type, direction, amount, currency, transaction_date, value_date, label, reference, description, third_party_id, customer_payment_id, supplier_payment_id, customer_invoice_id, supplier_invoice_id, reconciliation_status, reconciled_at, created_at, archived_at, account:treasury_account_id(name), third_party:third_party_id(name)";
const IMPORT_SELECT = "id, organization_id, treasury_account_id, import_code, file_name, file_type, file_hash, statement_fingerprint, period_start, period_end, imported_lines_count, matched_lines_count, unmatched_lines_count, status, imported_at, archived_at, account:treasury_account_id(name)";
const LEGACY_IMPORT_SELECT = "id, organization_id, treasury_account_id, file_name, file_type, period_start, period_end, imported_lines_count, matched_lines_count, unmatched_lines_count, status, imported_at, archived_at, account:treasury_account_id(name)";
const LINE_SELECT = "id, import_id, treasury_account_id, operation_date, value_date, label, reference, debit_amount, credit_amount, amount, direction, balance_after, reconciliation_status, matched_transaction_id, match_score, match_reason, line_hash, line_fingerprint";
const LEGACY_LINE_SELECT = "id, import_id, treasury_account_id, operation_date, value_date, label, reference, debit_amount, credit_amount, amount, direction, balance_after, reconciliation_status, matched_transaction_id, match_score, match_reason";

function isMissingColumnError(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("does not exist") || error?.message?.includes("schema cache"));
}

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function mapAccount(raw: unknown): TreasuryAccountRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    code: row.code as string | null,
    account_type: row.account_type as TreasuryAccountRecord["account_type"],
    bank_name: row.bank_name as string | null,
    agency_name: row.agency_name as string | null,
    rib: row.rib as string | null,
    iban: row.iban as string | null,
    swift: row.swift as string | null,
    account_number: row.account_number as string | null,
    currency: row.currency as string,
    opening_balance: Number(row.opening_balance ?? 0),
    current_balance: Number(row.current_balance ?? 0),
    opening_balance_date: row.opening_balance_date as string | null,
    is_default: Boolean(row.is_default),
    status: row.status as TreasuryAccountRecord["status"],
    notes: row.notes as string | null,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: row.archived_at as string | null,
  };
}

function mapTransaction(raw: unknown): TreasuryTransactionRecord {
  const row = raw as Record<string, unknown>;
  const account = objectValue(row.account);
  const thirdParty = objectValue(row.third_party);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    treasury_account_id: row.treasury_account_id as string,
    account_name: account?.name as string | null,
    transaction_type: row.transaction_type as TreasuryTransactionType,
    direction: row.direction as TreasuryTransactionDirection,
    amount: Number(row.amount ?? 0),
    currency: row.currency as string,
    transaction_date: row.transaction_date as string,
    value_date: row.value_date as string | null,
    label: row.label as string,
    reference: row.reference as string | null,
    description: row.description as string | null,
    third_party_id: row.third_party_id as string | null,
    third_party_name: thirdParty?.name as string | null,
    customer_payment_id: row.customer_payment_id as string | null,
    supplier_payment_id: row.supplier_payment_id as string | null,
    customer_invoice_id: row.customer_invoice_id as string | null,
    supplier_invoice_id: row.supplier_invoice_id as string | null,
    reconciliation_status: row.reconciliation_status as TreasuryTransactionRecord["reconciliation_status"],
    reconciled_at: row.reconciled_at as string | null,
    created_at: row.created_at as string,
    archived_at: row.archived_at as string | null,
  };
}

function mapImport(raw: unknown): BankStatementImportRecord {
  const row = raw as Record<string, unknown>;
  const account = objectValue(row.account);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    treasury_account_id: row.treasury_account_id as string,
    account_name: account?.name as string | null,
    import_code: (row.import_code as string | null | undefined) ?? null,
    file_name: row.file_name as string,
    file_type: row.file_type as string | null,
    file_hash: (row.file_hash as string | null | undefined) ?? null,
    statement_fingerprint: (row.statement_fingerprint as string | null | undefined) ?? null,
    period_start: row.period_start as string | null,
    period_end: row.period_end as string | null,
    imported_lines_count: Number(row.imported_lines_count ?? 0),
    matched_lines_count: Number(row.matched_lines_count ?? 0),
    unmatched_lines_count: Number(row.unmatched_lines_count ?? 0),
    status: row.status as string,
    imported_at: row.imported_at as string,
    archived_at: row.archived_at as string | null,
  };
}

function mapLine(raw: unknown): BankStatementLineRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    import_id: row.import_id as string,
    treasury_account_id: row.treasury_account_id as string,
    operation_date: row.operation_date as string,
    value_date: row.value_date as string | null,
    label: row.label as string,
    reference: row.reference as string | null,
    debit_amount: Number(row.debit_amount ?? 0),
    credit_amount: Number(row.credit_amount ?? 0),
    amount: Number(row.amount ?? 0),
    direction: row.direction as TreasuryTransactionDirection,
    balance_after: row.balance_after === null || row.balance_after === undefined ? null : Number(row.balance_after),
    reconciliation_status: row.reconciliation_status as BankStatementLineRecord["reconciliation_status"],
    matched_transaction_id: row.matched_transaction_id as string | null,
    match_score: row.match_score === null || row.match_score === undefined ? null : Number(row.match_score),
    match_reason: row.match_reason as string | null,
    line_hash: (row.line_hash as string | null | undefined) ?? null,
    line_fingerprint: (row.line_fingerprint as string | null | undefined) ?? null,
  };
}

async function activeOrgId() {
  const workspace = await requireActiveWorkspace();
  return workspace.organization.id;
}

export async function listTreasuryAccounts(): Promise<TreasuryAccountRecord[]> {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase.from("treasury_accounts").select(ACCOUNT_SELECT).eq("organization_id", orgId).is("archived_at", null).order("is_default", { ascending: false }).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAccount);
}

export async function listActiveTreasuryAccounts() {
  return (await listTreasuryAccounts()).filter((account) => account.status === "active");
}

export async function getDefaultTreasuryAccountId(): Promise<string> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from("treasury_accounts").select("id").eq("organization_id", workspace.organization.id).eq("status", "active").is("archived_at", null).order("is_default", { ascending: false }).order("created_at").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.id) return data.id as string;
  const { data: created, error: createError } = await supabase.from("treasury_accounts").insert({ organization_id: workspace.organization.id, name: "Banque principale", code: "BANK-MAIN", account_type: "bank", is_default: true, status: "active", created_by: workspace.userId }).select("id").single();
  if (createError || !created) throw new Error(createError?.message ?? "Impossible de creer le compte de tresorerie par defaut.");
  return created.id as string;
}

export async function getTreasuryAccountDetail(id: string) {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const [account, transactions] = await Promise.all([
    supabase.from("treasury_accounts").select(ACCOUNT_SELECT).eq("organization_id", orgId).eq("id", id).maybeSingle(),
    supabase.from("treasury_transactions").select(TRANSACTION_SELECT).eq("organization_id", orgId).eq("treasury_account_id", id).is("archived_at", null).order("transaction_date", { ascending: false }).limit(50),
  ]);
  if (account.error) throw new Error(account.error.message);
  if (transactions.error) throw new Error(transactions.error.message);
  return { account: account.data ? mapAccount(account.data) : null, transactions: (transactions.data ?? []).map(mapTransaction) };
}

export async function getTreasuryAccountLedger(accountId: string, filters: { direction?: string; type?: string; status?: string } = {}) {
  return listTreasuryTransactions({ accountId, ...filters });
}

export async function getTreasuryAccountBalance(accountId: string) {
  const detail = await getTreasuryAccountDetail(accountId);
  return detail.account?.current_balance ?? 0;
}

export async function listTreasuryTransactions(filters: { accountId?: string; direction?: string; type?: string; status?: string } = {}) {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  let query = supabase.from("treasury_transactions").select(TRANSACTION_SELECT).eq("organization_id", orgId).is("archived_at", null).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(100);
  if (filters.accountId) query = query.eq("treasury_account_id", filters.accountId);
  if (filters.direction && filters.direction !== "all") query = query.eq("direction", filters.direction);
  if (filters.type && filters.type !== "all") query = query.eq("transaction_type", filters.type);
  if (filters.status && filters.status !== "all") query = query.eq("reconciliation_status", filters.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTransaction);
}

export async function getTreasuryTransactionDetail(id: string) {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase.from("treasury_transactions").select(TRANSACTION_SELECT).eq("organization_id", orgId).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTransaction(data) : null;
}

export async function listBankStatementImports() {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const result = await supabase.from("bank_statement_imports").select(IMPORT_SELECT).eq("organization_id", orgId).is("archived_at", null).order("imported_at", { ascending: false });
  if (result.error && isMissingColumnError(result.error)) {
    const legacy = await supabase.from("bank_statement_imports").select(LEGACY_IMPORT_SELECT).eq("organization_id", orgId).is("archived_at", null).order("imported_at", { ascending: false });
    if (legacy.error) throw new Error(legacy.error.message);
    return (legacy.data ?? []).map(mapImport);
  }
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(mapImport);
}

export async function getBankStatementImportDetail(id: string) {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const importResult = await supabase.from("bank_statement_imports").select(IMPORT_SELECT).eq("organization_id", orgId).eq("id", id).maybeSingle();
  const importData = importResult.error && isMissingColumnError(importResult.error)
    ? await supabase.from("bank_statement_imports").select(LEGACY_IMPORT_SELECT).eq("organization_id", orgId).eq("id", id).maybeSingle()
    : importResult;
  const linesResult = await supabase.from("bank_statement_lines").select(LINE_SELECT).eq("organization_id", orgId).eq("import_id", id).order("operation_date", { ascending: false });
  const linesData = linesResult.error && isMissingColumnError(linesResult.error)
    ? await supabase.from("bank_statement_lines").select(LEGACY_LINE_SELECT).eq("organization_id", orgId).eq("import_id", id).order("operation_date", { ascending: false })
    : linesResult;
  if (importData.error) throw new Error(importData.error.message);
  if (linesData.error) throw new Error(linesData.error.message);
  return { statementImport: importData.data ? mapImport(importData.data) : null, lines: (linesData.data ?? []).map(mapLine) };
}

export async function listUnreconciledStatementLines(accountId: string) {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const result = await supabase.from("bank_statement_lines").select(LINE_SELECT).eq("organization_id", orgId).eq("treasury_account_id", accountId).eq("reconciliation_status", "unreconciled").order("operation_date", { ascending: false }).limit(100);
  if (result.error && isMissingColumnError(result.error)) {
    const legacy = await supabase.from("bank_statement_lines").select(LEGACY_LINE_SELECT).eq("organization_id", orgId).eq("treasury_account_id", accountId).eq("reconciliation_status", "unreconciled").order("operation_date", { ascending: false }).limit(100);
    if (legacy.error) throw new Error(legacy.error.message);
    return (legacy.data ?? []).map(mapLine);
  }
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(mapLine);
}

export async function listUnreconciledTreasuryTransactions(accountId: string) {
  return listTreasuryTransactions({ accountId, status: "unreconciled" });
}

export async function getReconciliationWorkspace(accountId?: string, options: { includeSuggestions?: boolean } = {}) {
  const accounts = await listActiveTreasuryAccounts();
  const selectedAccountId = accountId || accounts[0]?.id || "";
  const [statementLines, transactions] = selectedAccountId ? await Promise.all([listUnreconciledStatementLines(selectedAccountId), listUnreconciledTreasuryTransactions(selectedAccountId)]) : [[], []];
  return { accounts, selectedAccountId, statementLines, transactions, suggestions: options.includeSuggestions ? suggestMatches(statementLines, transactions) : [] };
}

function daysBetween(a: string, b: string) {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function normalized(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function suggestMatches(lines: BankStatementLineRecord[], transactions: TreasuryTransactionRecord[]): ReconciliationSuggestion[] {
  return lines.flatMap((line) => {
    let best: TreasuryTransactionRecord | null = null;
    let bestScore = 0;
    let reason = "";
    for (const tx of transactions) {
      let score = 0;
      const reasons: string[] = [];
      if (Math.abs(tx.amount - line.amount) < 0.01) { score += 50; reasons.push("montant identique"); }
      if (tx.direction === line.direction) { score += 20; reasons.push("sens identique"); }
      const operationDateDiff = Math.min(daysBetween(tx.transaction_date, line.operation_date), tx.value_date ? daysBetween(tx.value_date, line.operation_date) : 999);
      if (operationDateDiff === 0) { score += 20; reasons.push("date identique"); }
      else if (operationDateDiff <= 2) { score += 15; reasons.push("date proche 2 jours"); }
      else if (operationDateDiff <= 5) { score += 10; reasons.push("date proche 5 jours"); }
      const lineRef = normalized(line.reference);
      const txRef = normalized(tx.reference);
      const lineLabel = normalized(line.label);
      const txLabel = normalized(tx.label);
      if (lineRef && txRef && lineRef === txRef) { score += 20; reasons.push("reference identique"); }
      else if ((lineRef && txLabel.includes(lineRef)) || (txRef && lineLabel.includes(txRef))) { score += 10; reasons.push("reference dans libelle"); }
      if (score > bestScore) { best = tx; bestScore = score; reason = reasons.join(", "); }
    }
    if (!best || bestScore < 60) return [];
    return [{ statementLine: line, transaction: best, score: bestScore, label: bestScore >= 80 ? "Suggestion forte" : "Suggestion moyenne", reason }];
  });
}

export async function suggestBankReconciliationMatches(accountId: string) {
  const workspace = await getReconciliationWorkspace(accountId);
  return workspace.suggestions;
}

export async function getTreasuryDashboard(): Promise<TreasuryCounters & { accounts: TreasuryAccountRecord[]; recentTransactions: TreasuryTransactionRecord[] }> {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [accounts, transactions, statementCount] = await Promise.all([
    listTreasuryAccounts(),
    supabase.from("treasury_transactions").select(TRANSACTION_SELECT).eq("organization_id", orgId).is("archived_at", null).gte("transaction_date", monthStart).order("transaction_date", { ascending: false }).limit(20),
    supabase.from("bank_statement_lines").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("reconciliation_status", "unreconciled"),
  ]);
  if (transactions.error) throw new Error(transactions.error.message);
  const txRows = (transactions.data ?? []).map(mapTransaction);
  const monthlyIn = txRows.filter((tx) => tx.direction === "in").reduce((sum, tx) => sum + tx.amount, 0);
  const monthlyOut = txRows.filter((tx) => tx.direction === "out").reduce((sum, tx) => sum + tx.amount, 0);
  return {
    bankBalance: accounts.filter((a) => a.account_type === "bank").reduce((sum, a) => sum + a.current_balance, 0),
    cashBalance: accounts.filter((a) => a.account_type === "cash").reduce((sum, a) => sum + a.current_balance, 0),
    monthlyIn,
    monthlyOut,
    monthlyNet: monthlyIn - monthlyOut,
    unreconciledStatementLines: statementCount.count ?? 0,
    unreconciledTransactions: txRows.filter((tx) => tx.reconciliation_status === "unreconciled").length,
    accounts,
    recentTransactions: txRows,
  };
}

export async function getTreasuryAccountCounters() {
  const accounts = await listTreasuryAccounts();
  return { total: accounts.length, active: accounts.filter((account) => account.status === "active").length, defaultAccount: accounts.find((account) => account.is_default) ?? null };
}

const CONSULTATION_TRANSACTION_SELECT = "id, organization_id, treasury_account_id, transaction_type, direction, amount, currency, transaction_date, value_date, label, reference, description, third_party_id, customer_payment_id, supplier_payment_id, customer_invoice_id, supplier_invoice_id, reconciliation_status, reconciled_at, created_at, archived_at, account:treasury_account_id(name, account_type), third_party:third_party_id(name, primary_type)";

type ConsultationRaw = Record<string, unknown> & { account?: { name: string; account_type: string } | Record<string, unknown> | null; third_party?: { name: string; primary_type: string } | Record<string, unknown> | null };

async function resolvePaymentMethods(
  customerPaymentIds: string[],
  supplierPaymentIds: string[],
): Promise<Map<string, { method: string; reference: string | null }>> {
  const map = new Map<string, { method: string; reference: string | null }>();
  const supabase = await createClient();
  if (customerPaymentIds.length > 0) {
    const { data } = await supabase.from("customer_payments").select("id, payment_method, reference").in("id", customerPaymentIds);
    for (const p of data ?? []) {
      map.set(p.id as string, { method: p.payment_method as string, reference: p.reference as string | null });
    }
  }
  if (supplierPaymentIds.length > 0) {
    const { data } = await supabase.from("supplier_payments").select("id, payment_method, reference").in("id", supplierPaymentIds);
    for (const p of data ?? []) {
      map.set(p.id as string, { method: p.payment_method as string, reference: p.reference as string | null });
    }
  }
  return map;
}

async function resolveInvoiceNumbers(
  customerInvoiceIds: string[],
  supplierInvoiceIds: string[],
): Promise<Map<string, { number: string; source_type: string }>> {
  const map = new Map<string, { number: string; source_type: string }>();
  const supabase = await createClient();
  if (customerInvoiceIds.length > 0) {
    const { data } = await supabase.from("customer_invoices").select("id, invoice_number").in("id", customerInvoiceIds);
    for (const inv of data ?? []) {
      map.set(inv.id as string, { number: inv.invoice_number as string, source_type: "customer" });
    }
  }
  if (supplierInvoiceIds.length > 0) {
    const { data } = await supabase.from("supplier_invoices").select("id, invoice_number").in("id", supplierInvoiceIds);
    for (const inv of data ?? []) {
      map.set(inv.id as string, { number: inv.invoice_number as string, source_type: "supplier" });
    }
  }
  return map;
}

async function resolveAccountingStatus(
  documentIds: string[],
): Promise<Map<string, { id: string; entry_number: string; status: string }>> {
  const map = new Map<string, { id: string; entry_number: string; status: string }>();
  if (documentIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_entries")
    .select("id, entry_number, status, source_document_id")
    .neq("status", "cancelled")
    .in("source_document_id", documentIds);
  for (const entry of data ?? []) {
    const srcId = entry.source_document_id as string;
    if (!map.has(srcId)) {
      map.set(srcId, { id: entry.id as string, entry_number: entry.entry_number as string, status: entry.status as string });
    }
  }
  return map;
}

export async function listTreasuryConsultationFlows(filters: TreasuryConsultationFilters): Promise<{
  rows: TreasuryConsultationRow[];
  summary: TreasuryConsultationSummary;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const orgId = await activeOrgId();
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

  let accountIds: string[] | null = null;
  if (filters.account_type) {
    const { data: accounts } = await supabase
      .from("treasury_accounts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("account_type", filters.account_type)
      .is("archived_at", null);
    accountIds = (accounts ?? []).map((a) => a.id as string);
    if (accountIds.length === 0) {
      return { rows: [], summary: zeroSummary(), total: 0, page, pageSize, totalPages: 0 };
    }
  }

  let query = supabase.from("treasury_transactions").select(CONSULTATION_TRANSACTION_SELECT, { count: "exact" }).eq("organization_id", orgId).is("archived_at", null);

  if (filters.date_from) query = query.gte("transaction_date", filters.date_from);
  if (filters.date_to) query = query.lte("transaction_date", filters.date_to);
  if (filters.treasury_account_id) query = query.eq("treasury_account_id", filters.treasury_account_id);
  else if (accountIds) query = query.in("treasury_account_id", accountIds);
  if (filters.direction && filters.direction !== "all") query = query.eq("direction", filters.direction);
  if (filters.transaction_type && filters.transaction_type !== "all") query = query.eq("transaction_type", filters.transaction_type);
  if (filters.reconciliation_status && filters.reconciliation_status !== "all") query = query.eq("reconciliation_status", filters.reconciliation_status);
  if (filters.third_party_id) query = query.eq("third_party_id", filters.third_party_id);
  if (filters.q) {
    const q = `%${filters.q}%`;
    query = query.or(`label.ilike.${q},reference.ilike.${q}`);
  }

  query = query.order("transaction_date", { ascending: false }).order("created_at", { ascending: false });
  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data: rawData, error, count } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const rows = rawData as unknown as ConsultationRaw[];
  if (rows.length === 0) {
    return { rows: [], summary: zeroSummary(), total, page, pageSize, totalPages };
  }

  const customerPaymentIds = rows.filter((r) => r.customer_payment_id).map((r) => r.customer_payment_id as string);
  const supplierPaymentIds = rows.filter((r) => r.supplier_payment_id).map((r) => r.supplier_payment_id as string);
  const customerInvoiceIds = rows.filter((r) => r.customer_invoice_id).map((r) => r.customer_invoice_id as string);
  const supplierInvoiceIds = rows.filter((r) => r.supplier_invoice_id).map((r) => r.supplier_invoice_id as string);

  const allDocIds = [...new Set([...customerPaymentIds, ...supplierPaymentIds, ...customerInvoiceIds, ...supplierInvoiceIds])];

  const [paymentMethods, invoiceNumbers, accountingStatusMap] = await Promise.all([
    resolvePaymentMethods(customerPaymentIds, supplierPaymentIds),
    resolveInvoiceNumbers(customerInvoiceIds, supplierInvoiceIds),
    resolveAccountingStatus(allDocIds),
  ]);

  const result: TreasuryConsultationRow[] = rows.map((r) => {
    const account = (r.account ?? null) as { name: string; account_type: string } | null;
    const thirdParty = (r.third_party ?? null) as { name: string; primary_type: string } | null;
    const paymentId = (r.customer_payment_id ?? r.supplier_payment_id) as string | null;
    const pm = paymentId ? paymentMethods.get(paymentId) : undefined;
    const invId = (r.customer_invoice_id ?? r.supplier_invoice_id) as string | null;
    const invInfo = invId ? invoiceNumbers.get(invId) : undefined;
    const accEntry = invId ? accountingStatusMap.get(invId) : paymentId ? accountingStatusMap.get(paymentId) : undefined;
    const isPosted = accEntry?.status === "posted";

    return {
      id: r.id as string,
      transaction_date: r.transaction_date as string,
      value_date: r.value_date as string | null,
      treasury_account_id: r.treasury_account_id as string,
      account_name: account?.name ?? null,
      account_type: account?.account_type ?? null,
      transaction_type: r.transaction_type as TreasuryTransactionType,
      direction: r.direction as TreasuryTransactionDirection,
      amount: Number(r.amount ?? 0),
      label: r.label as string,
      reference: r.reference as string | null,
      third_party_id: r.third_party_id as string | null,
      third_party_name: thirdParty?.name ?? null,
      third_party_type: thirdParty?.primary_type ?? null,
      payment_method: pm?.method ?? null,
      payment_reference: pm?.reference ?? null,
      customer_payment_id: r.customer_payment_id as string | null,
      supplier_payment_id: r.supplier_payment_id as string | null,
      customer_invoice_id: r.customer_invoice_id as string | null,
      supplier_invoice_id: r.supplier_invoice_id as string | null,
      customer_invoice_number: invInfo?.source_type === "customer" ? invInfo.number : null,
      supplier_invoice_number: invInfo?.source_type === "supplier" ? invInfo.number : null,
      reconciliation_status: r.reconciliation_status as TreasuryConsultationRow["reconciliation_status"],
      accounting_status: accEntry ? (isPosted ? "posted" : "not_posted") : "not_applicable",
      accounting_entry_number: accEntry?.entry_number ?? null,
      accounting_entry_id: accEntry?.id ?? null,
      currency: r.currency as string,
      created_at: r.created_at as string,
    };
  });

  const summary: TreasuryConsultationSummary = {
    total_entries: result.length,
    total_in: result.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0),
    total_out: result.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0),
    net_flow: 0,
    posted_count: result.filter((r) => r.accounting_status === "posted").length,
    not_posted_count: result.filter((r) => r.accounting_status === "not_posted").length,
    reconciled_count: result.filter((r) => r.reconciliation_status === "reconciled").length,
    unreconciled_count: result.filter((r) => r.reconciliation_status !== "reconciled").length,
  };
  summary.net_flow = summary.total_in - summary.total_out;

  let filtered = result;
  if (filters.accounting_status && filters.accounting_status !== "all") {
    filtered = filtered.filter((r) => r.accounting_status === filters.accounting_status);
  }
  if (filters.payment_method && filters.payment_method !== "all") {
    filtered = filtered.filter((r) => r.payment_method === filters.payment_method);
  }
  if (filters.q && filters.q.trim()) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter((r) =>
      r.label.toLowerCase().includes(q) ||
      (r.reference ?? "").toLowerCase().includes(q) ||
      (r.third_party_name ?? "").toLowerCase().includes(q)
    );
  }

  return { rows: filtered, summary, total, page, pageSize, totalPages };
}

function zeroSummary(): TreasuryConsultationSummary {
  return { total_entries: 0, total_in: 0, total_out: 0, net_flow: 0, posted_count: 0, not_posted_count: 0, reconciled_count: 0, unreconciled_count: 0 };
}
