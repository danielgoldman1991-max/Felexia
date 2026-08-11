import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type {
  AccountingAccountRecord,
  AccountingJournalDetail,
  AccountingJournalEntryFilters,
  AccountingJournalEntryListResult,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  AccountingJournalRecord,
  AccountingJournalWithStats,
  ChartOfAccountFilters,
  ChartOfAccountOption,
  ChartOfAccountUsageStats,
  VatPreparationSummary,
} from "@/lib/accounting-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";

export type AccountingLine = {
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  label: string;
};

export const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: "1111", name: "Capital social", type: "equity" },
  { code: "1191", name: "Resultat net de l'exercice", type: "equity" },
  { code: "2111", name: "Frais preliminaires", type: "asset" },
  { code: "2332", name: "Materiel de transport", type: "asset" },
  { code: "2355", name: "Materiel informatique", type: "asset" },
  { code: "3111", name: "Marchandises", type: "asset" },
  { code: "3421", name: "Clients", type: "third_party" },
  { code: "3455", name: "Etat - TVA recuperable", type: "tax" },
  { code: "3488", name: "Divers debiteurs", type: "asset" },
  { code: "4411", name: "Fournisseurs", type: "third_party" },
  { code: "4455", name: "Etat - TVA facturee", type: "tax" },
  { code: "4488", name: "Divers crediteurs", type: "liability" },
  { code: "4501", name: "Etat - Impots et taxes", type: "liability" },
  { code: "5141", name: "Banques", type: "treasury" },
  { code: "5161", name: "Caisses", type: "treasury" },
  { code: "5520", name: "Credit de tresorerie", type: "liability" },
  { code: "6111", name: "Achats de marchandises", type: "expense" },
  { code: "6122", name: "Achats consommes / services", type: "expense" },
  { code: "6147", name: "Services bancaires", type: "expense" },
  { code: "6156", name: "Honoraires", type: "expense" },
  { code: "6161", name: "Impots et taxes", type: "expense" },
  { code: "6171", name: "Charges de personnel", type: "expense" },
  { code: "6311", name: "Interets des emprunts", type: "expense" },
  { code: "6588", name: "Autres charges diverses", type: "expense" },
  { code: "7111", name: "Ventes de marchandises", type: "revenue" },
  { code: "7121", name: "Ventes de biens et services produits", type: "revenue" },
  { code: "7124", name: "Prestations de services", type: "revenue" },
  { code: "7381", name: "Interets et produits assimiles", type: "revenue" },
  { code: "7588", name: "Autres produits divers", type: "revenue" },
] as const;

export const DEFAULT_ACCOUNTING_JOURNALS = [
  { code: "VE", name: "Journal des ventes", type: "sales", description: "Ecritures de ventes et facturation client" },
  { code: "AC", name: "Journal des achats", type: "purchases", description: "Ecritures d'achats et facturation fournisseur" },
  { code: "BQ", name: "Journal banque", type: "bank", description: "Operations bancaires" },
  { code: "CA", name: "Journal caisse", type: "cash", description: "Operations de caisse" },
  { code: "OD", name: "Operations diverses", type: "od", description: "Ecritures diverses et corrections" },
] as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getAccountByNumber(organizationId: string, accountNumber: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_accounts")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .eq("code", accountNumber)
    .maybeSingle();
  return data as { id: string; code: string; name: string } | null;
}

export async function getJournalByCode(organizationId: string, journalCode: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_journals")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .eq("code", journalCode)
    .maybeSingle();
  return data as { id: string; code: string; name: string } | null;
}

export async function getAccountingSettings(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function listActiveChartOfAccounts(): Promise<ChartOfAccountOption[]> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_accounts")
    .select("id, code, name, type, is_active")
    .eq("organization_id", workspace.organization.id)
    .eq("is_active", true)
    .order("code", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    account_number: row.code as string,
    account_name: row.name as string,
    account_type: row.type as string | null,
    is_active: Boolean(row.is_active),
  }));
}

function asJournal(row: Record<string, unknown>): AccountingJournalRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    code: row.code as AccountingJournalRecord["code"],
    name: row.name as string,
    type: row.type as AccountingJournalRecord["type"],
    description: row.description as string | null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function asEntryRow(row: Record<string, unknown>): AccountingJournalEntryRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    entry_number: row.entry_number as string,
    journal_id: row.journal_id as string,
    fiscal_year_id: row.fiscal_year_id as string | null,
    period_id: row.period_id as string | null,
    entry_date: row.entry_date as string,
    reference: row.reference as string | null,
    label: row.label as string,
    source_module: row.source_module as string | null,
    source_document_type: row.source_document_type as string | null,
    source_document_id: row.source_document_id as string | null,
    source_number: row.source_number as string | null,
    status: row.status as AccountingJournalEntryRow["status"],
    total_debit: Number(row.total_debit ?? 0),
    total_credit: Number(row.total_credit ?? 0),
    created_by: row.created_by as string | null,
    posted_by: row.posted_by as string | null,
    posted_at: row.posted_at as string | null,
    reversed_entry_id: row.reversed_entry_id as string | null,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function normalizeFilters(filters: AccountingJournalEntryFilters = {}) {
  return {
    ...filters,
    status: filters.status && ["draft", "posted"].includes(filters.status) ? filters.status : undefined,
    source_type: filters.source_type && filters.source_type !== "all" ? filters.source_type : undefined,
    page: filters.page && filters.page > 0 ? filters.page : 1,
    pageSize: filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 50,
  };
}

async function getMatchingEntryIds(organizationId: string, journalId: string, filters: AccountingJournalEntryFilters) {
  const supabase = await createClient();
  let idSet: Set<string> | null = null;

  async function intersect(ids: string[]) {
    const next = new Set(ids);
    idSet = idSet ? new Set([...idSet].filter((id) => next.has(id))) : next;
  }

  if (filters.account_id) {
    const { data, error } = await supabase
      .from("accounting_entry_lines")
      .select("entry_id")
      .eq("organization_id", organizationId)
      .eq("account_id", filters.account_id);
    if (error) throw new Error(error.message);
    await intersect((data ?? []).map((row) => row.entry_id as string));
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    const [entryMatches, lineMatches] = await Promise.all([
      supabase
        .from("accounting_entries")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("journal_id", journalId)
        .or(`entry_number.ilike.%${q}%,label.ilike.%${q}%,reference.ilike.%${q}%,source_document_type.ilike.%${q}%`),
      supabase
        .from("accounting_entry_lines")
        .select("entry_id")
        .eq("organization_id", organizationId)
        .or(`label.ilike.%${q}%,account_code.ilike.%${q}%,account_label.ilike.%${q}%`),
    ]);
    if (entryMatches.error) throw new Error(entryMatches.error.message);
    if (lineMatches.error) throw new Error(lineMatches.error.message);
    const ids = new Set<string>();
    for (const row of entryMatches.data ?? []) ids.add(row.id as string);
    for (const row of lineMatches.data ?? []) ids.add(row.entry_id as string);
    await intersect([...ids]);
  }

  void filters.third_party_id;
  return idSet ? [...idSet] : null;
}

async function fetchJournalEntries(
  organizationId: string,
  journalId: string,
  filters: AccountingJournalEntryFilters,
  range?: { from: number; to: number },
) {
  const supabase = await createClient();
  const normalized = normalizeFilters(filters);
  const matchingIds = await getMatchingEntryIds(organizationId, journalId, normalized);
  if (matchingIds && matchingIds.length === 0) return { entries: [], count: 0 };

  let query = supabase
    .from("accounting_entries")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("journal_id", journalId)
    .in("status", ["draft", "posted"]);

  if (normalized.date_from) query = query.gte("entry_date", normalized.date_from);
  if (normalized.date_to) query = query.lte("entry_date", normalized.date_to);
  if (normalized.status) query = query.eq("status", normalized.status);
  if (normalized.source_type) query = query.eq("source_document_type", normalized.source_type);
  if (matchingIds) query = query.in("id", matchingIds);
  query = query.order("entry_date", { ascending: false }).order("entry_number", { ascending: false });
  if (range) query = query.range(range.from, range.to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { entries: (data ?? []).map((row) => asEntryRow(row as Record<string, unknown>)), count: count ?? 0 };
}

async function getLinesForEntries(organizationId: string, entries: AccountingJournalEntryRow[]): Promise<AccountingJournalLineRow[]> {
  if (entries.length === 0) return [];
  const supabase = await createClient();
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .in("entry_id", entries.map((entry) => entry.id))
    .order("line_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const entry = entryById.get(row.entry_id as string);
    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      entry_id: row.entry_id as string,
      line_number: Number(row.line_number ?? 0),
      account_id: row.account_id as string,
      account_code: row.account_code as string,
      account_label: row.account_label as string,
      auxiliary_id: row.auxiliary_id as string | null,
      debit: Number(row.debit ?? 0),
      credit: Number(row.credit ?? 0),
      label: row.label as string | null,
      due_date: row.due_date as string | null,
      reconciliation_status: row.reconciliation_status as AccountingJournalLineRow["reconciliation_status"],
      created_at: row.created_at as string,
      entry_number: entry?.entry_number ?? "",
      entry_date: entry?.entry_date ?? "",
      entry_label: entry?.label ?? "",
      entry_status: entry?.status ?? "draft",
    };
  });
}

export async function listAccountingJournalsWithStats(): Promise<AccountingJournalWithStats[]> {
  const workspace = await requireActiveWorkspace();
  const organizationId = workspace.organization.id;
  const supabase = await createClient();
  const [{ data: journals, error: journalError }, { data: entries, error: entryError }] = await Promise.all([
    supabase.from("accounting_journals").select("*").eq("organization_id", organizationId).order("code"),
    supabase.from("accounting_entries").select("journal_id, total_debit, total_credit, entry_date, status").eq("organization_id", organizationId).in("status", ["draft", "posted"]),
  ]);
  if (journalError) throw new Error(journalError.message);
  if (entryError) throw new Error(entryError.message);
  return (journals ?? []).map((journalRow) => {
    const journal = asJournal(journalRow as Record<string, unknown>);
    const journalEntries = (entries ?? []).filter((entry) => entry.journal_id === journal.id);
    return {
      ...journal,
      entries_count: journalEntries.length,
      total_debit: journalEntries.reduce((sum, entry) => sum + Number(entry.total_debit ?? 0), 0),
      total_credit: journalEntries.reduce((sum, entry) => sum + Number(entry.total_credit ?? 0), 0),
      last_entry_date: journalEntries.map((entry) => entry.entry_date as string).sort().at(-1) ?? null,
    };
  });
}

export async function getAccountingJournalDetail(journalId: string): Promise<AccountingJournalDetail> {
  const journals = await listAccountingJournalsWithStats();
  const stats = journals.find((journal) => journal.id === journalId) ?? null;
  return { journal: stats, stats };
}

export async function listAccountingJournalEntries(journalId: string, filters: AccountingJournalEntryFilters = {}): Promise<AccountingJournalEntryListResult> {
  const workspace = await requireActiveWorkspace();
  const organizationId = workspace.organization.id;
  const normalized = normalizeFilters(filters);
  const page = normalized.page ?? 1;
  const pageSize = normalized.pageSize ?? 50;
  const all = await fetchJournalEntries(organizationId, journalId, { ...normalized, pageSize: 10000 });
  const from = (page - 1) * pageSize;
  const pageEntries = all.entries.slice(from, from + pageSize);
  const lines = await getLinesForEntries(organizationId, pageEntries);
  return {
    entries: pageEntries,
    lines,
    total: all.entries.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(all.entries.length / pageSize)),
    stats: {
      entries_count: all.entries.length,
      total_debit: all.entries.reduce((sum, entry) => sum + entry.total_debit, 0),
      total_credit: all.entries.reduce((sum, entry) => sum + entry.total_credit, 0),
    },
  };
}

export async function listAccountingJournalExportRows(journalId: string, filters: AccountingJournalEntryFilters = {}) {
  const workspace = await requireActiveWorkspace();
  const organizationId = workspace.organization.id;
  const all = await fetchJournalEntries(organizationId, journalId, { ...filters, pageSize: 10000 });
  const lines = await getLinesForEntries(organizationId, all.entries);
  return { entries: all.entries, lines };
}

export async function getExistingEntryBySource(
  organizationId: string,
  sourceType: string,
  sourceId: string,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_entries")
    .select("id, entry_number, status")
    .eq("organization_id", organizationId)
    .eq("source_document_type", sourceType)
    .eq("source_document_id", sourceId)
    .neq("status", "cancelled")
    .maybeSingle();
  return data as { id: string; entry_number: string; status: string } | null;
}

export async function getEntryWithLinesBySource(
  organizationId: string,
  sourceType: string,
  sourceId: string,
) {
  const supabase = await createClient();
  const entry = await getExistingEntryBySource(organizationId, sourceType, sourceId);
  if (!entry) return null;
  const { data: lines } = await supabase
    .from("accounting_entry_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("entry_id", entry.id)
    .order("line_number");
  const { data: fullEntry } = await supabase
    .from("accounting_entries")
    .select("*, journal:accounting_journals!inner(code, name)")
    .eq("organization_id", organizationId)
    .eq("id", entry.id)
    .maybeSingle();
  return {
    entry: fullEntry ? {
      ...fullEntry,
      journal_code: (fullEntry as Record<string, unknown>).journal_code as string ?? (fullEntry as { journal?: { code: string } }).journal?.code,
      journal_name: (fullEntry as Record<string, unknown>).journal_name as string ?? (fullEntry as { journal?: { name: string } }).journal?.name,
    } : null,
    lines: lines ?? [],
  };
}

function accountingEntryStep(entry: { id: string; entry_number: string; status: string | null }): DocumentFlowStep {
  return {
    label: "Ecriture",
    number: entry.entry_number,
    href: `/comptabilite/ecritures/${entry.id}`,
    status: entry.status,
    isCurrent: true,
    type: "accounting_entry",
  };
}

export async function getAccountingEntryDocumentFlow(entryId: string): Promise<DocumentFlowStep[]> {
  const workspace = await requireActiveWorkspace();
  const organizationId = workspace.organization.id;
  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from("accounting_entries")
    .select("id, entry_number, status, source_document_type, source_document_id")
    .eq("organization_id", organizationId)
    .eq("id", entryId)
    .in("status", ["draft", "posted"])
    .maybeSingle();

  if (error || !entry) return [];

  const current = accountingEntryStep(entry as { id: string; entry_number: string; status: string | null });
  const sourceType = entry.source_document_type as string | null;
  const sourceId = entry.source_document_id as string | null;
  if (!sourceType || !sourceId) return [current];

  if (sourceType === "customer_invoice") {
    const { data: invoice } = await supabase
      .from("customer_invoices")
      .select("id, invoice_number, status")
      .eq("organization_id", organizationId)
      .eq("id", sourceId)
      .is("archived_at", null)
      .maybeSingle();
    return invoice ? [
      {
        label: "Facture",
        number: invoice.invoice_number as string,
        href: `/facturation/factures/${invoice.id}`,
        status: invoice.status as string | null,
        type: "customer_invoice",
      },
      current,
    ] : [current];
  }

  if (sourceType === "supplier_invoice") {
    const { data: invoice } = await supabase
      .from("supplier_invoices")
      .select("id, invoice_number, status")
      .eq("organization_id", organizationId)
      .eq("id", sourceId)
      .is("archived_at", null)
      .maybeSingle();
    return invoice ? [
      {
        label: "Facture fournisseur",
        number: invoice.invoice_number as string,
        href: `/achats/factures/${invoice.id}`,
        status: invoice.status as string | null,
        type: "supplier_invoice",
      },
      current,
    ] : [current];
  }

  if (sourceType === "credit_note") {
    const { data: creditNote } = await supabase
      .from("customer_credit_notes")
      .select("id, credit_note_number, status")
      .eq("organization_id", organizationId)
      .eq("id", sourceId)
      .is("archived_at", null)
      .maybeSingle();
    return creditNote ? [
      {
        label: "Avoir",
        number: creditNote.credit_note_number as string,
        href: `/facturation/avoirs/${creditNote.id}`,
        status: creditNote.status as string | null,
        type: "credit_note",
      },
      current,
    ] : [current];
  }

  return [current];
}

export async function getProductById(organizationId: string, productId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, type, name, sales_account_id, purchase_account_id")
    .eq("organization_id", organizationId)
    .eq("id", productId)
    .maybeSingle();
  return data as {
    id: string;
    type: string;
    name: string;
    sales_account_id: string | null;
    purchase_account_id: string | null;
  } | null;
}

export async function getOrCreateAccountId(
  organizationId: string,
  accountNumber: string,
): Promise<string> {
  const existing = await getAccountByNumber(organizationId, accountNumber);
  if (existing) return existing.id;
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_accounts")
    .insert({
      organization_id: organizationId,
      code: accountNumber,
      name: `Compte ${accountNumber}`,
      class_number: accountNumber.charAt(0),
      type: "other",
      is_system: true,
    })
    .select("id")
    .single();
  if (!data) throw new Error(`Impossible de creer le compte ${accountNumber}`);
  return data.id;
}

export async function ensureAccountingBaseSetup(organizationId: string) {
  const [accounts, journals, settings] = await Promise.all([
    ensureDefaultChartOfAccounts(organizationId),
    ensureDefaultAccountingJournals(organizationId),
    ensureAccountingSettings(organizationId),
  ]);

  return { accounts, journals, settings };
}

function padNumber(n: number, width: number) {
  return String(n).padStart(width, "0");
}

export async function generateEntryNumber(
  organizationId: string,
  journalCode: string,
): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const prefix = `${journalCode}-${year}-`;
  const { data } = await supabase
    .from("accounting_entries")
    .select("entry_number")
    .eq("organization_id", organizationId)
    .ilike("entry_number", `${prefix}%`)
    .order("entry_number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.entry_number
    ? Number(String(data[0].entry_number).split("-").at(-1) ?? 0)
    : 0;
  return `${prefix}${padNumber(last + 1, 5)}`;
}

export function buildCustomerInvoiceLines(
  lines: Array<{
    product_id: string | null;
    product_name: string | null;
    description: string;
    subtotal_ht: number;
    discount_amount: number;
    tax_amount: number;
    total_ttc: number;
    tax_rate: number;
  }>,
  accountIds: {
    sales_product: string;
    sales_service: string;
    customer: string;
    sales_vat: string;
  },
): AccountingLine[] {
  const result: AccountingLine[] = [];
  let totalHt = 0;
  let totalVat = 0;

  const grouped: Record<string, { ht: number; label: string }> = {};
  for (const line of lines) {
    const accountId = line.product_id ? accountIds.sales_product : accountIds.sales_service;
    // Customer invoice subtotals are already net of the line discount.
    // Subtracting discount_amount here a second time understates both revenue
    // and the customer receivable.
    const ht = round2(line.subtotal_ht);
    if (grouped[accountId]) {
      grouped[accountId].ht += ht;
    } else {
      grouped[accountId] = { ht, label: line.product_name || line.description || "Ventes" };
    }
    totalHt += ht;
    totalVat += round2(line.tax_amount ?? 0);
  }

  for (const [accountId, g] of Object.entries(grouped)) {
    result.push({
      account_id: accountId,
      account_code: "",
      account_name: g.label,
      debit: 0,
      credit: round2(g.ht),
      label: g.label,
    });
  }

  if (totalVat > 0) {
    result.push({
      account_id: accountIds.sales_vat,
      account_code: "",
      account_name: "TVA collectee",
      debit: 0,
      credit: round2(totalVat),
      label: "TVA facturee",
    });
  }

  const totalTtc = round2(totalHt + totalVat);
  result.unshift({
    account_id: accountIds.customer,
    account_code: "",
    account_name: "Clients",
    debit: round2(totalTtc),
    credit: 0,
    label: "Facture client",
  });

  return result;
}

export function buildSupplierInvoiceLines(
  lines: Array<{
    product_id: string | null;
    product_name: string | null;
    description: string;
    subtotal_ht: number;
    discount_amount: number;
    tax_amount: number;
    total_ttc: number;
    tax_rate: number;
  }>,
  accountIds: {
    purchase_product: string;
    purchase_service: string;
    supplier: string;
    purchase_vat: string;
  },
): AccountingLine[] {
  const result: AccountingLine[] = [];
  let totalHt = 0;
  let totalVat = 0;

  const grouped: Record<string, { ht: number; label: string }> = {};
  for (const line of lines) {
    const accountId = line.product_id ? accountIds.purchase_product : accountIds.purchase_service;
    const ht = round2(line.subtotal_ht - (line.discount_amount ?? 0));
    if (grouped[accountId]) {
      grouped[accountId].ht += ht;
    } else {
      grouped[accountId] = { ht, label: line.product_name || line.description || "Achats" };
    }
    totalHt += ht;
    totalVat += round2(line.tax_amount ?? 0);
  }

  for (const [accountId, g] of Object.entries(grouped)) {
    result.push({
      account_id: accountId,
      account_code: "",
      account_name: g.label,
      debit: round2(g.ht),
      credit: 0,
      label: g.label,
    });
  }

  if (totalVat > 0) {
    result.push({
      account_id: accountIds.purchase_vat,
      account_code: "",
      account_name: "TVA recuperable",
      debit: round2(totalVat),
      credit: 0,
      label: "TVA recuperable",
    });
  }

  const totalTtc = round2(totalHt + totalVat);
  result.push({
    account_id: accountIds.supplier,
    account_code: "",
    account_name: "Fournisseurs",
    debit: 0,
    credit: round2(totalTtc),
    label: "Facture fournisseur",
  });

  return result;
}

export function verifyBalanced(lines: AccountingLine[]) {
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

function asAccountRecord(row: Record<string, unknown>): AccountingAccountRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    code: row.code as string,
    name: row.name as string,
    class_number: row.class_number as string,
    type: row.type as AccountingAccountRecord["type"],
    parent_code: row.parent_code as string | null,
    parent_account_id: row.parent_account_id as string | null,
    is_movement_allowed: Boolean(row.is_movement_allowed),
    is_auxiliary_required: Boolean(row.is_auxiliary_required),
    is_auxiliary: Boolean(row.is_auxiliary ?? false),
    is_active: Boolean(row.is_active),
    is_system: Boolean(row.is_system),
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: row.archived_at as string | null,
  };
}

export async function listChartOfAccounts(filters: ChartOfAccountFilters = {}): Promise<{
  rows: AccountingAccountRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

  let query = supabase
    .from("accounting_accounts")
    .select("*", { count: "exact" })
    .eq("organization_id", workspace.organization.id);

  if (!filters.include_archived) {
    query = query.is("archived_at", null);
  }

  if (filters.q) {
    const q = `%${filters.q}%`;
    query = query.or(`code.ilike.${q},name.ilike.${q}`);
  }
  if (filters.account_class) {
    query = query.eq("class_number", filters.account_class);
  }
  if (filters.account_type) {
    query = query.eq("type", filters.account_type);
  }
  if (filters.is_auxiliary !== undefined) {
    query = query.eq("is_auxiliary", filters.is_auxiliary);
  }
  if (filters.is_active === "active") {
    query = query.eq("is_active", true);
  } else if (filters.is_active === "inactive") {
    query = query.eq("is_active", false);
  }
  if (filters.parent_account_id) {
    query = query.eq("parent_account_id", filters.parent_account_id);
  }

  query = query.order("code", { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    rows: (data ?? []).map((r) => asAccountRecord(r as Record<string, unknown>)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getChartOfAccountDetail(accountId: string) {
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const account = asAccountRecord(data as Record<string, unknown>);

  let parent: AccountingAccountRecord | null = null;
  if (account.parent_account_id) {
    const { data: p } = await supabase
      .from("accounting_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .eq("id", account.parent_account_id)
      .maybeSingle();
    if (p) parent = asAccountRecord(p as Record<string, unknown>);
  }

  const childrenQuery = await supabase
    .from("accounting_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("parent_account_id", accountId)
    .is("archived_at", null)
    .limit(1);
  const hasChildren = (childrenQuery.data?.length ?? 0) > 0;

  return { account, parent, hasChildren };
}

export async function getChartOfAccountUsageStats(accountId: string): Promise<ChartOfAccountUsageStats> {
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("debit, credit, created_at")
    .eq("organization_id", orgId)
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);
  const lines = data ?? [];
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  const dates = lines.map((l) => l.created_at as string).filter(Boolean).sort();
  return {
    lines_count: lines.length,
    total_debit: totalDebit,
    total_credit: totalCredit,
    balance: totalDebit - totalCredit,
    last_used_date: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}

export async function listRecentEntryLinesForAccount(accountId: string, limit = 20) {
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("*, entry:accounting_entries!inner(id, entry_number, entry_date, status, journal_id)")
    .eq("organization_id", orgId)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const entry = (row as Record<string, unknown>).entry as Record<string, unknown> | undefined;
    return {
      id: row.id as string,
      entry_id: row.entry_id as string,
      entry_number: (entry?.entry_number as string) ?? "",
      entry_date: (entry?.entry_date as string) ?? "",
      entry_status: (entry?.status as string) ?? "",
      line_number: Number(row.line_number ?? 0),
      account_code: row.account_code as string,
      account_label: row.account_label as string,
      debit: Number(row.debit ?? 0),
      credit: Number(row.credit ?? 0),
      label: row.label as string | null,
      created_at: row.created_at as string,
    };
  });
}

export type AccountingReportLine = {
  id: string;
  line_number: number;
  account_id: string;
  account_code: string;
  account_label: string;
  debit: number;
  credit: number;
  label: string | null;
  entry_id: string;
  entry_number: string;
  entry_date: string;
  entry_label: string;
  entry_reference: string | null;
  journal_code: string;
  journal_name: string;
};

export async function getAccountingReportLines(filters: { dateFrom?: string; dateTo?: string } = {}): Promise<AccountingReportLine[]> {
  const workspace = await requireActiveWorkspace();
  const organizationId = workspace.organization.id;
  const supabase = await createClient();

  let query = supabase
    .from("accounting_entry_lines")
    .select("id, line_number, account_id, account_code, account_label, debit, credit, label, entry:accounting_entries!inner(id, entry_number, entry_date, reference, label, status, journal:accounting_journals(code, name))")
    .eq("organization_id", organizationId)
    .eq("entry.status", "posted")
    .limit(10000);

  if (filters.dateFrom) query = query.gte("entry.entry_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("entry.entry_date", filters.dateTo);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const entryValue = (row as Record<string, unknown>).entry;
    const entry = (Array.isArray(entryValue) ? entryValue[0] : entryValue) as Record<string, unknown> | undefined;
    const journalValue = entry?.journal;
    const journal = (Array.isArray(journalValue) ? journalValue[0] : journalValue) as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      line_number: Number(row.line_number ?? 0),
      account_id: String(row.account_id ?? ""),
      account_code: String(row.account_code ?? ""),
      account_label: String(row.account_label ?? ""),
      debit: Number(row.debit ?? 0),
      credit: Number(row.credit ?? 0),
      label: row.label ? String(row.label) : null,
      entry_id: String(entry?.id ?? ""),
      entry_number: String(entry?.entry_number ?? ""),
      entry_date: String(entry?.entry_date ?? ""),
      entry_label: String(entry?.label ?? ""),
      entry_reference: entry?.reference ? String(entry.reference) : null,
      journal_code: String(journal?.code ?? ""),
      journal_name: String(journal?.name ?? ""),
    };
  }).sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number) || a.line_number - b.line_number);
}

export async function isAccountUsedInEntries(accountId: string): Promise<boolean> {
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("account_id", accountId)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function ensureDefaultChartOfAccounts(organizationId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("accounting_accounts")
    .select("code")
    .eq("organization_id", organizationId);
  const existingCodes = new Set((existing ?? []).map((a) => a.code as string));
  const missing = DEFAULT_CHART_OF_ACCOUNTS.filter((d) => !existingCodes.has(d.code));

  if (missing.length > 0) {
    const { error } = await supabase.from("accounting_accounts").insert(
      missing.map((d) => ({
        organization_id: organizationId,
        code: d.code,
        name: d.name,
        class_number: d.code.charAt(0),
        type: d.type,
        is_active: true,
        is_movement_allowed: true,
        is_auxiliary_required: false,
        is_auxiliary: false,
        is_system: true,
      })),
    );
    if (error) throw new Error(`Erreur lors de la creation des comptes par defaut: ${error.message}`);
  }

  return { created: missing.length, existing: existingCodes.size, total: DEFAULT_CHART_OF_ACCOUNTS.length };
}

export async function ensureDefaultAccountingJournals(organizationId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("accounting_journals")
    .select("code")
    .eq("organization_id", organizationId);
  const existingCodes = new Set((existing ?? []).map((journal) => journal.code as string));
  const missing = DEFAULT_ACCOUNTING_JOURNALS.filter((journal) => !existingCodes.has(journal.code));

  if (missing.length > 0) {
    const { error } = await supabase.from("accounting_journals").insert(
      missing.map((journal) => ({
        organization_id: organizationId,
        code: journal.code,
        name: journal.name,
        type: journal.type,
        description: journal.description,
        is_active: true,
      })),
    );
    if (error) throw new Error(`Erreur lors de la creation des journaux par defaut: ${error.message}`);
  }

  return { created: missing.length, existing: existingCodes.size, total: DEFAULT_ACCOUNTING_JOURNALS.length };
}

export async function ensureAccountingSettings(organizationId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("accounting_settings")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (existing) return { created: 0, skipped: true };

  const payload = {
    organization_id: organizationId,
    sales_journal_code: "VE",
    purchases_journal_code: "AC",
    bank_journal_code: "BQ",
    cash_journal_code: "CA",
    od_journal_code: "OD",
  };

  const { error } = await supabase
    .from("accounting_settings")
    .insert(payload);

  if (error) {
    return { created: 0, skipped: true, error: error.message };
  }

  return { created: 1, skipped: false };
}

function getNextPeriod(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month === 12) return `01/${year + 1}`;
  const next = month + 1;
  return `${next.toString().padStart(2, "0")}/${year}`;
}

export async function getVatPreparationSummary(): Promise<VatPreparationSummary> {
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const supabase = await createClient();

  const { data: accounts, error: accountsError } = await supabase
    .from("accounting_accounts")
    .select("id, code")
    .eq("organization_id", orgId)
    .or("code.like.4455%,code.like.3455%");
  if (accountsError) throw new Error(accountsError.message);
  const collectedIds = (accounts ?? []).filter((account) => String(account.code).startsWith("4455")).map((account) => account.id as string);
  const deductibleIds = (accounts ?? []).filter((account) => String(account.code).startsWith("3455")).map((account) => account.id as string);

  if (collectedIds.length === 0 || deductibleIds.length === 0) {
    return { collectedVat: null, deductibleVat: null, estimatedVatBalance: null, nextPeriod: getNextPeriod() };
  }

  const [collectedResult, deductibleResult] = await Promise.all([
    supabase
      .from("accounting_entry_lines")
      .select("debit, credit, entry:accounting_entries!inner(status)")
      .eq("organization_id", orgId)
      .in("account_id", collectedIds)
      .eq("entry.status", "posted"),
    supabase
      .from("accounting_entry_lines")
      .select("debit, credit, entry:accounting_entries!inner(status)")
      .eq("organization_id", orgId)
      .in("account_id", deductibleIds)
      .eq("entry.status", "posted"),
  ]);
  if (collectedResult.error) throw new Error(collectedResult.error.message);
  if (deductibleResult.error) throw new Error(deductibleResult.error.message);

  const collectedLines = collectedResult.data ?? [];
  const deductibleLines = deductibleResult.data ?? [];

  const collectedDebit = collectedLines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const collectedCredit = collectedLines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  const collectedVat = Math.round((collectedCredit - collectedDebit) * 100) / 100;

  const deductibleDebit = deductibleLines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const deductibleCredit = deductibleLines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
  const deductibleVat = Math.round((deductibleDebit - deductibleCredit) * 100) / 100;

  return {
    collectedVat,
    deductibleVat,
    estimatedVatBalance: Math.round((collectedVat - deductibleVat) * 100) / 100,
    nextPeriod: getNextPeriod(),
  };
}
