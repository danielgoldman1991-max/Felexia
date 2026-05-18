import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

export type VatExportType =
  | "summary"
  | "collected"
  | "deductible"
  | "customer_invoices"
  | "supplier_invoices"
  | "deductions"
  | "archive"
  | "dgi";

export type VatExportFilters = {
  from?: string;
  to?: string;
  type?: VatExportType | string;
  regime?: string;
  source?: string;
  status?: string;
  format?: string;
  q?: string;
};

export type VatExportSummary = {
  collectedVat: number;
  deductibleVat: number;
  estimatedBalance: number;
  customerInvoicesCount: number;
  supplierInvoicesCount: number;
  includedDocumentsCount: number;
  controlsCount: number;
  warningIssuesCount: number;
  blockingIssuesCount: number;
  isReady: boolean;
  lastExportLabel: string | null;
};

export type VatExportRow = {
  id: string;
  source: "customer_invoice" | "supplier_invoice" | "accounting_entry";
  documentType: string;
  documentNumber: string;
  documentDate: string | null;
  thirdPartyName: string | null;
  thirdPartyIce: string | null;
  baseHt: number;
  taxRate: number | null;
  vatAmount: number;
  totalTtc: number;
  documentStatus: string | null;
  accountingStatus: string | null;
  sourceLabel: string;
  observation: string | null;
  createdAt: string;
};

export type VatExportControl = {
  key: string;
  label: string;
  severity: "ok" | "warning" | "blocking";
  count: number;
  message: string;
};

export type VatExportBatch = {
  id: string;
  export_number: string;
  export_type: string;
  period_start: string | null;
  period_end: string | null;
  regime?: string | null;
  format: string;
  status: string;
  file_name: string | null;
  file_path?: string | null;
  controls_summary?: Record<string, unknown> | null;
  totals?: Record<string, unknown> | null;
  generated_at: string;
  generated_by_name: string | null;
};

export type VatExportPreview = {
  organization: {
    id: string;
    name: string;
  };
  filters: VatExportFilters;
  summary: VatExportSummary;
  rows: VatExportRow[];
  controls: VatExportControl[];
  exportHistory: VatExportBatch[];
};

export type DgiVatPreparationData = {
  organization: {
    id: string;
    name: string;
    ice: string | null;
    ifNumber: string | null;
  };
  period: {
    start: string | null;
    end: string | null;
    regime: string | null;
  };
  summary: VatExportSummary & {
    salesBaseHt: number;
    salesTotalTtc: number;
    purchasesBaseHt: number;
    purchasesTotalTtc: number;
    creditVat: number;
    status: "blocked" | "generated_with_warnings" | "ready";
  };
  collectedVatRows: VatExportRow[];
  deductibleVatRows: VatExportRow[];
  deductionStatementRows: VatExportRow[];
  accountingVatRows: VatExportRow[];
  controls: VatExportControl[];
  isReady: boolean;
};

type InvoiceRecord = {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  status: string | null;
  subtotal_ht: number | null;
  tax_total: number | null;
  total_ttc: number | null;
  created_at: string;
  third_party_name: string | null;
  third_party_ice: string | null;
  source: "customer_invoice" | "supplier_invoice";
};

type InvoiceLineRecord = {
  invoice_id: string;
  subtotal_ht: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_ttc: number | null;
};

const CANCELLED_STATUS = "cancelled";
const POSTED_LABEL = "Comptabilisée";
const NOT_POSTED_LABEL = "Non comptabilisée";
export const TAX_EXPORTS_BUCKET = "tax-exports";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown) {
  return Number(value ?? 0) || 0;
}

function objectValue(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function firstParam(value?: string) {
  return value && value.trim() ? value.trim() : undefined;
}

export function normalizeVatExportFilters(filters: VatExportFilters = {}): VatExportFilters {
  return {
    from: firstParam(filters.from),
    to: firstParam(filters.to),
    type: filters.type || "summary",
    regime: filters.regime || "monthly",
    source: filters.source || "all",
    status: filters.status || "all",
    format: filters.format || "csv",
    q: firstParam(filters.q),
  };
}

function filterByDate<T extends { invoice_date?: string | null; created_at?: string | null }>(
  rows: T[],
  filters: VatExportFilters,
) {
  return rows.filter((row) => {
    const date = row.invoice_date ?? row.created_at;
    if (!date) return true;
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;
    return true;
  });
}

function groupInvoiceLines(
  invoice: InvoiceRecord,
  lines: InvoiceLineRecord[],
  posted: boolean,
): VatExportRow[] {
  if (lines.length === 0) {
    const vatAmount = toNumber(invoice.tax_total);
    return [{
      id: `${invoice.source}:${invoice.id}`,
      source: invoice.source,
      documentType: invoice.source === "customer_invoice" ? "Facture client" : "Facture fournisseur",
      documentNumber: invoice.invoice_number,
      documentDate: invoice.invoice_date,
      thirdPartyName: invoice.third_party_name,
      thirdPartyIce: invoice.third_party_ice,
      baseHt: roundMoney(toNumber(invoice.subtotal_ht)),
      taxRate: null,
      vatAmount: roundMoney(vatAmount),
      totalTtc: roundMoney(toNumber(invoice.total_ttc)),
      documentStatus: invoice.status,
      accountingStatus: posted ? POSTED_LABEL : NOT_POSTED_LABEL,
      sourceLabel: invoice.source === "customer_invoice" ? "Factures clients" : "Factures fournisseurs",
      observation: vatAmount > 0 ? "Détail TVA incomplet, total facture utilisé." : "Aucun détail TVA disponible.",
      createdAt: invoice.created_at,
    }];
  }

  const grouped = new Map<string, { taxRate: number | null; baseHt: number; vatAmount: number; totalTtc: number }>();
  for (const line of lines) {
    const taxRate = line.tax_rate === null || line.tax_rate === undefined ? null : toNumber(line.tax_rate);
    const key = taxRate === null ? "unknown" : String(taxRate);
    const current = grouped.get(key) ?? { taxRate, baseHt: 0, vatAmount: 0, totalTtc: 0 };
    current.baseHt += toNumber(line.subtotal_ht);
    current.vatAmount += toNumber(line.tax_amount);
    current.totalTtc += toNumber(line.total_ttc);
    grouped.set(key, current);
  }

  return [...grouped.values()].map((group, index) => ({
    id: `${invoice.source}:${invoice.id}:${group.taxRate ?? "unknown"}:${index}`,
    source: invoice.source,
    documentType: invoice.source === "customer_invoice" ? "Facture client" : "Facture fournisseur",
    documentNumber: invoice.invoice_number,
    documentDate: invoice.invoice_date,
    thirdPartyName: invoice.third_party_name,
    thirdPartyIce: invoice.third_party_ice,
    baseHt: roundMoney(group.baseHt),
    taxRate: group.taxRate,
    vatAmount: roundMoney(group.vatAmount),
    totalTtc: roundMoney(group.totalTtc),
    documentStatus: invoice.status,
    accountingStatus: posted ? POSTED_LABEL : NOT_POSTED_LABEL,
    sourceLabel: invoice.source === "customer_invoice" ? "Factures clients" : "Factures fournisseurs",
    observation: group.vatAmount === 0 ? "Ligne sans montant TVA." : null,
    createdAt: invoice.created_at,
  }));
}

async function getPostedInvoiceIds(organizationId: string, sourceType: "customer_invoice" | "supplier_invoice", ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_entries")
    .select("source_document_id")
    .eq("organization_id", organizationId)
    .eq("source_document_type", sourceType)
    .in("source_document_id", ids)
    .eq("status", "posted");

  return new Set((data ?? []).map((entry) => entry.source_document_id as string).filter(Boolean));
}

async function listCustomerInvoiceRows(organizationId: string, filters: VatExportFilters) {
  const supabase = await createClient();
  let invoiceQuery = supabase
    .from("customer_invoices")
    .select("id, invoice_number, invoice_date, status, subtotal_ht, tax_total, total_ttc, created_at, customer:customer_id(name, ice)")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .neq("status", CANCELLED_STATUS)
    .order("invoice_date", { ascending: false });

  if (filters.from) invoiceQuery = invoiceQuery.gte("invoice_date", filters.from);
  if (filters.to) invoiceQuery = invoiceQuery.lte("invoice_date", filters.to);

  const { data: rawInvoices, error } = await invoiceQuery;
  if (error) throw new Error(error.message);

  const invoices: InvoiceRecord[] = (rawInvoices ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const customer = objectValue(record.customer);
    return {
      id: record.id as string,
      invoice_number: record.invoice_number as string,
      invoice_date: record.invoice_date as string | null,
      status: record.status as string | null,
      subtotal_ht: toNumber(record.subtotal_ht),
      tax_total: toNumber(record.tax_total),
      total_ttc: toNumber(record.total_ttc),
      created_at: record.created_at as string,
      third_party_name: customer?.name as string | null,
      third_party_ice: customer?.ice as string | null,
      source: "customer_invoice",
    };
  });

  const invoiceIds = invoices.map((invoice) => invoice.id);
  const [{ data: rawLines }, postedIds] = await Promise.all([
    invoiceIds.length > 0
      ? supabase
        .from("customer_invoice_lines")
        .select("invoice_id, subtotal_ht, tax_rate, tax_amount, total_ttc")
        .eq("organization_id", organizationId)
        .in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] }),
    getPostedInvoiceIds(organizationId, "customer_invoice", invoiceIds),
  ]);

  const linesByInvoice = new Map<string, InvoiceLineRecord[]>();
  for (const line of (rawLines ?? []) as Record<string, unknown>[]) {
    const invoiceId = line.invoice_id as string;
    const list = linesByInvoice.get(invoiceId) ?? [];
    list.push({
      invoice_id: invoiceId,
      subtotal_ht: toNumber(line.subtotal_ht),
      tax_rate: line.tax_rate === null ? null : toNumber(line.tax_rate),
      tax_amount: toNumber(line.tax_amount),
      total_ttc: toNumber(line.total_ttc),
    });
    linesByInvoice.set(invoiceId, list);
  }

  return invoices.flatMap((invoice) => groupInvoiceLines(invoice, linesByInvoice.get(invoice.id) ?? [], postedIds.has(invoice.id)));
}

async function listSupplierInvoiceRows(organizationId: string, filters: VatExportFilters) {
  const supabase = await createClient();
  let invoiceQuery = supabase
    .from("supplier_invoices")
    .select("id, invoice_number, supplier_invoice_number, invoice_date, status, subtotal_ht, tax_total, total_ttc, created_at, supplier:supplier_id(name, ice)")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .neq("status", CANCELLED_STATUS)
    .order("invoice_date", { ascending: false });

  if (filters.from) invoiceQuery = invoiceQuery.gte("invoice_date", filters.from);
  if (filters.to) invoiceQuery = invoiceQuery.lte("invoice_date", filters.to);

  const { data: rawInvoices, error } = await invoiceQuery;
  if (error) throw new Error(error.message);

  const invoices: InvoiceRecord[] = (rawInvoices ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const supplier = objectValue(record.supplier);
    const supplierNumber = record.supplier_invoice_number ? ` / ${record.supplier_invoice_number}` : "";
    return {
      id: record.id as string,
      invoice_number: `${record.invoice_number as string}${supplierNumber}`,
      invoice_date: record.invoice_date as string | null,
      status: record.status as string | null,
      subtotal_ht: toNumber(record.subtotal_ht),
      tax_total: toNumber(record.tax_total),
      total_ttc: toNumber(record.total_ttc),
      created_at: record.created_at as string,
      third_party_name: supplier?.name as string | null,
      third_party_ice: supplier?.ice as string | null,
      source: "supplier_invoice",
    };
  });

  const invoiceIds = invoices.map((invoice) => invoice.id);
  const [{ data: rawLines }, postedIds] = await Promise.all([
    invoiceIds.length > 0
      ? supabase
        .from("supplier_invoice_lines")
        .select("invoice_id, subtotal_ht, tax_rate, tax_amount, total_ttc")
        .eq("organization_id", organizationId)
        .in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] }),
    getPostedInvoiceIds(organizationId, "supplier_invoice", invoiceIds),
  ]);

  const linesByInvoice = new Map<string, InvoiceLineRecord[]>();
  for (const line of (rawLines ?? []) as Record<string, unknown>[]) {
    const invoiceId = line.invoice_id as string;
    const list = linesByInvoice.get(invoiceId) ?? [];
    list.push({
      invoice_id: invoiceId,
      subtotal_ht: toNumber(line.subtotal_ht),
      tax_rate: line.tax_rate === null ? null : toNumber(line.tax_rate),
      tax_amount: toNumber(line.tax_amount),
      total_ttc: toNumber(line.total_ttc),
    });
    linesByInvoice.set(invoiceId, list);
  }

  return invoices.flatMap((invoice) => groupInvoiceLines(invoice, linesByInvoice.get(invoice.id) ?? [], postedIds.has(invoice.id)));
}

async function listAccountingVatRows(organizationId: string, filters: VatExportFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("id, account_code, account_label, debit, credit, label, created_at, entry:accounting_entries!inner(entry_number, entry_date, status)")
    .eq("organization_id", organizationId)
    .in("account_code", ["3455", "34552", "4455"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return [];

  const rows = ((data ?? []) as Record<string, unknown>[]).map((line) => {
    const entry = objectValue(line.entry);
    const accountCode = String(line.account_code ?? "");
    const isCollected = accountCode.startsWith("445");
    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);
    const vatAmount = isCollected ? credit - debit : debit - credit;
    return {
      id: `accounting_entry:${line.id as string}`,
      source: "accounting_entry" as const,
      documentType: isCollected ? "Écriture TVA collectée" : "Écriture TVA récupérable",
      documentNumber: (entry?.entry_number as string) ?? "-",
      documentDate: (entry?.entry_date as string) ?? null,
      thirdPartyName: null,
      thirdPartyIce: null,
      baseHt: 0,
      taxRate: null,
      vatAmount: roundMoney(vatAmount),
      totalTtc: 0,
      documentStatus: entry?.status as string | null,
      accountingStatus: entry?.status === "posted" ? POSTED_LABEL : NOT_POSTED_LABEL,
      sourceLabel: "Écritures comptables",
      observation: line.label as string | null,
      createdAt: line.created_at as string,
    };
  });

  return filterByDate(rows.map((row) => ({ ...row, invoice_date: row.documentDate, created_at: row.createdAt })), filters);
}

function applyRowFilters(rows: VatExportRow[], filters: VatExportFilters) {
  const query = filters.q?.toLowerCase();
  return rows.filter((row) => {
    if (filters.source === "customer_invoices" && row.source !== "customer_invoice") return false;
    if (filters.source === "supplier_invoices" && row.source !== "supplier_invoice") return false;
    if (filters.source === "accounting_entries" && row.source !== "accounting_entry") return false;
    if (filters.type === "collected" && row.source !== "customer_invoice") return false;
    if (filters.type === "deductible" && row.source !== "supplier_invoice") return false;
    if (filters.type === "customer_invoices" && row.source !== "customer_invoice") return false;
    if (filters.type === "supplier_invoices" && row.source !== "supplier_invoice") return false;
    if (filters.status === "validated" && !["validated", "sent", "partially_paid", "paid", "overdue"].includes(row.documentStatus ?? "")) return false;
    if (filters.status === "posted" && row.accountingStatus !== POSTED_LABEL) return false;
    if (filters.status === "not_posted" && row.accountingStatus !== NOT_POSTED_LABEL) return false;
    if (filters.status === "anomaly" && !row.observation && row.vatAmount > 0 && row.thirdPartyIce) return false;
    if (query) {
      const haystack = [
        row.documentNumber,
        row.documentType,
        row.thirdPartyName,
        row.thirdPartyIce,
        row.documentStatus,
        row.sourceLabel,
        row.observation,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function buildControls(rows: VatExportRow[]): VatExportControl[] {
  const customerWithoutVat = new Set(rows.filter((row) => row.source === "customer_invoice" && row.vatAmount === 0).map((row) => row.documentNumber));
  const supplierWithoutVat = new Set(rows.filter((row) => row.source === "supplier_invoice" && row.vatAmount === 0).map((row) => row.documentNumber));
  const notPosted = new Set(rows.filter((row) => row.source !== "accounting_entry" && row.accountingStatus === NOT_POSTED_LABEL && row.documentStatus !== "draft").map((row) => row.documentNumber));
  const missingIce = new Set(rows.filter((row) => row.source !== "accounting_entry" && !row.thirdPartyIce).map((row) => row.documentNumber));
  const missingTaxRate = rows.filter((row) => row.source !== "accounting_entry" && row.taxRate === null && row.vatAmount > 0).length;
  const hasRows = rows.length > 0;

  return [
    {
      key: "customer_without_vat",
      label: "Factures clients sans TVA",
      severity: customerWithoutVat.size > 0 ? "warning" : "ok",
      count: customerWithoutVat.size,
      message: customerWithoutVat.size > 0
        ? "Certaines factures clients incluses ne portent aucun montant TVA."
        : "Les factures clients incluses comportent une TVA cohérente ou sont hors champ.",
    },
    {
      key: "supplier_without_vat",
      label: "Factures fournisseurs sans TVA",
      severity: supplierWithoutVat.size > 0 ? "warning" : "ok",
      count: supplierWithoutVat.size,
      message: supplierWithoutVat.size > 0
        ? "Certaines factures fournisseurs n'ont aucun montant TVA récupérable."
        : "Les factures fournisseurs incluses comportent une TVA cohérente ou sont hors champ.",
    },
    {
      key: "not_posted",
      label: "Pièces non comptabilisées",
      severity: notPosted.size > 0 ? "warning" : "ok",
      count: notPosted.size,
      message: notPosted.size > 0
        ? "Certaines pièces validées ne semblent pas encore comptabilisées."
        : "Les pièces validées incluses sont rapprochées avec une écriture comptable.",
    },
    {
      key: "missing_ice",
      label: "Tiers sans ICE",
      severity: missingIce.size > 0 ? "warning" : "ok",
      count: missingIce.size,
      message: missingIce.size > 0
        ? "Certains tiers n'ont pas d'ICE renseigné."
        : "Les tiers des pièces incluses disposent d'un ICE.",
    },
    {
      key: "missing_tax_rate",
      label: "Taux TVA manquant",
      severity: missingTaxRate > 0 ? "warning" : "ok",
      count: missingTaxRate,
      message: missingTaxRate > 0
        ? "Certaines lignes ont un montant TVA sans taux TVA détaillé."
        : "Les lignes TVA détaillées comportent un taux exploitable.",
    },
    {
      key: "period_data",
      label: "Données de période",
      severity: hasRows ? "ok" : "warning",
      count: rows.length,
      message: hasRows
        ? "La période sélectionnée contient des lignes exportables."
        : "Aucune ligne exportable n'a été trouvée sur cette période.",
    },
  ];
}

function blockingControl(key: string, label: string, count: number, message: string): VatExportControl {
  return {
    key,
    label,
    severity: count > 0 ? "blocking" : "ok",
    count,
    message,
  };
}

function dgiControlSet(preview: VatExportPreview, organizationIce: string | null) {
  const rows = preview.rows;
  const missingNumbers = rows.filter((row) => !row.documentNumber || row.documentNumber === "-").length;
  const missingDates = rows.filter((row) => !row.documentDate).length;
  const missingRates = rows.filter((row) => row.source !== "accounting_entry" && row.vatAmount > 0 && row.taxRate === null).length;
  const negativeVat = rows.filter((row) => row.vatAmount < 0 && !row.documentType.toLowerCase().includes("avoir")).length;
  const missingCustomer = rows.filter((row) => row.source === "customer_invoice" && !row.thirdPartyName).length;
  const missingSupplier = rows.filter((row) => row.source === "supplier_invoice" && !row.thirdPartyName).length;
  const periodStart = preview.filters.from;
  const periodEnd = preview.filters.to;
  const invalidPeriod = periodStart && periodEnd && periodStart > periodEnd ? 1 : 0;

  return [
    blockingControl(
      "organization_ice",
      "ICE organisation",
      organizationIce ? 0 : 1,
      organizationIce
        ? "L'organisation dispose d'un ICE pour le dossier préparatoire."
        : "L'organisation ne dispose pas d'ICE renseigné.",
    ),
    blockingControl(
      "missing_document_number",
      "Facture sans numéro",
      missingNumbers,
      missingNumbers > 0 ? "Certaines pièces n'ont pas de numéro." : "Toutes les pièces ont un numéro.",
    ),
    blockingControl(
      "missing_document_date",
      "Facture sans date",
      missingDates,
      missingDates > 0 ? "Certaines pièces n'ont pas de date." : "Toutes les pièces ont une date.",
    ),
    blockingControl(
      "missing_tax_rate_blocking",
      "Ligne TVA sans taux",
      missingRates,
      missingRates > 0 ? "Certaines lignes TVA positives n'ont pas de taux exploitable." : "Les lignes TVA positives ont un taux exploitable.",
    ),
    blockingControl(
      "negative_vat",
      "Montant TVA négatif incohérent",
      negativeVat,
      negativeVat > 0 ? "Des montants TVA négatifs apparaissent hors avoir." : "Aucun montant TVA négatif incohérent détecté.",
    ),
    blockingControl(
      "missing_supplier",
      "Facture fournisseur sans fournisseur",
      missingSupplier,
      missingSupplier > 0 ? "Certaines factures fournisseurs n'ont pas de fournisseur." : "Les factures fournisseurs sont rattachées à un fournisseur.",
    ),
    blockingControl(
      "missing_customer",
      "Facture client sans client",
      missingCustomer,
      missingCustomer > 0 ? "Certaines factures clients n'ont pas de client." : "Les factures clients sont rattachées à un client.",
    ),
    blockingControl(
      "empty_period",
      "Période vide",
      rows.length === 0 ? 1 : 0,
      rows.length === 0 ? "Aucune ligne TVA n'est exportable sur la période." : "La période contient des lignes TVA exportables.",
    ),
    blockingControl(
      "invalid_period",
      "Date début supérieure à date fin",
      invalidPeriod,
      invalidPeriod > 0 ? "La date de début est postérieure à la date de fin." : "La période sélectionnée est cohérente.",
    ),
    ...preview.controls,
  ];
}

async function listExportHistory(organizationId: string): Promise<VatExportBatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_export_batches")
    .select("id, export_number, export_type, period_start, period_end, regime, format, status, file_name, file_path, controls_summary, totals, generated_at")
    .eq("organization_id", organizationId)
    .order("generated_at", { ascending: false })
    .limit(10);

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id as string,
    export_number: row.export_number as string,
    export_type: row.export_type as string,
    period_start: row.period_start as string | null,
    period_end: row.period_end as string | null,
    regime: row.regime as string | null,
    format: row.format as string,
    status: row.status as string,
    file_name: row.file_name as string | null,
    file_path: row.file_path as string | null,
    controls_summary: row.controls_summary as Record<string, unknown> | null,
    totals: row.totals as Record<string, unknown> | null,
    generated_at: row.generated_at as string,
    generated_by_name: null,
  }));
}

export async function getVatExportPreview(inputFilters: VatExportFilters = {}): Promise<VatExportPreview> {
  const workspace = await requireActiveWorkspace();
  const organizationId = workspace.organization.id;
  const filters = normalizeVatExportFilters(inputFilters);

  const includeCustomers = filters.source !== "supplier_invoices" && filters.source !== "accounting_entries";
  const includeSuppliers = filters.source !== "customer_invoices" && filters.source !== "accounting_entries";
  const includeAccounting = filters.source === "accounting_entries";

  const [customerRows, supplierRows, accountingRows, exportHistory] = await Promise.all([
    includeCustomers ? listCustomerInvoiceRows(organizationId, filters) : Promise.resolve([]),
    includeSuppliers ? listSupplierInvoiceRows(organizationId, filters) : Promise.resolve([]),
    includeAccounting ? listAccountingVatRows(organizationId, filters) : Promise.resolve([]),
    listExportHistory(organizationId),
  ]);

  const rows = applyRowFilters([...customerRows, ...supplierRows, ...accountingRows], filters)
    .sort((a, b) => String(b.documentDate ?? b.createdAt).localeCompare(String(a.documentDate ?? a.createdAt)));
  const controls = buildControls(rows);
  const warningIssuesCount = controls.filter((control) => control.severity === "warning").reduce((sum, control) => sum + control.count, 0);
  const blockingIssuesCount = controls.filter((control) => control.severity === "blocking").reduce((sum, control) => sum + control.count, 0);
  const collectedVat = rows
    .filter((row) => row.source === "customer_invoice" || row.documentType.includes("collectée"))
    .reduce((sum, row) => sum + row.vatAmount, 0);
  const deductibleVat = rows
    .filter((row) => row.source === "supplier_invoice" || row.documentType.includes("récupérable"))
    .reduce((sum, row) => sum + row.vatAmount, 0);
  const customerInvoicesCount = new Set(rows.filter((row) => row.source === "customer_invoice").map((row) => row.documentNumber)).size;
  const supplierInvoicesCount = new Set(rows.filter((row) => row.source === "supplier_invoice").map((row) => row.documentNumber)).size;
  const includedDocumentsCount = new Set(rows.map((row) => `${row.source}:${row.documentNumber}`)).size;

  return {
    organization: {
      id: organizationId,
      name: workspace.organization.name,
    },
    filters,
    summary: {
      collectedVat: roundMoney(collectedVat),
      deductibleVat: roundMoney(deductibleVat),
      estimatedBalance: roundMoney(collectedVat - deductibleVat),
      customerInvoicesCount,
      supplierInvoicesCount,
      includedDocumentsCount,
      controlsCount: controls.length,
      warningIssuesCount,
      blockingIssuesCount,
      isReady: rows.length > 0 && blockingIssuesCount === 0 && warningIssuesCount === 0,
      lastExportLabel: exportHistory[0]?.export_number ?? null,
    },
    rows,
    controls,
    exportHistory,
  };
}

export function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function dgiCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function dgiCsvRow(values: unknown[]) {
  return values.map(dgiCsvCell).join(";");
}

export async function getDgiVatPreparationData(inputFilters: VatExportFilters = {}): Promise<DgiVatPreparationData> {
  const preview = await getVatExportPreview({
    ...inputFilters,
    type: inputFilters.type ?? "dgi",
    source: inputFilters.source ?? "all",
  });
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("company_settings")
    .select("ice, if_number")
    .eq("organization_id", preview.organization.id)
    .maybeSingle();
  const { data: organization } = await supabase
    .from("organizations")
    .select("ice, if_number")
    .eq("id", preview.organization.id)
    .maybeSingle();

  const organizationIce = ((company?.ice as string | null) ?? (organization?.ice as string | null) ?? null) || null;
  const organizationIf = ((company?.if_number as string | null) ?? (organization?.if_number as string | null) ?? null) || null;
  const controls = dgiControlSet(preview, organizationIce);
  const blockingIssuesCount = controls.filter((control) => control.severity === "blocking").reduce((sum, control) => sum + control.count, 0);
  const warningIssuesCount = controls.filter((control) => control.severity === "warning").reduce((sum, control) => sum + control.count, 0);
  const collectedVatRows = preview.rows.filter((row) => row.source === "customer_invoice");
  const deductibleVatRows = preview.rows.filter((row) => row.source === "supplier_invoice");
  const accountingVatRows = preview.rows.filter((row) => row.source === "accounting_entry");
  const status = blockingIssuesCount > 0 ? "blocked" : warningIssuesCount > 0 ? "generated_with_warnings" : "ready";
  const salesBaseHt = collectedVatRows.reduce((sum, row) => sum + row.baseHt, 0);
  const salesTotalTtc = collectedVatRows.reduce((sum, row) => sum + row.totalTtc, 0);
  const purchasesBaseHt = deductibleVatRows.reduce((sum, row) => sum + row.baseHt, 0);
  const purchasesTotalTtc = deductibleVatRows.reduce((sum, row) => sum + row.totalTtc, 0);

  return {
    organization: {
      id: preview.organization.id,
      name: preview.organization.name,
      ice: organizationIce,
      ifNumber: organizationIf,
    },
    period: {
      start: preview.filters.from ?? null,
      end: preview.filters.to ?? null,
      regime: preview.filters.regime ?? null,
    },
    summary: {
      ...preview.summary,
      salesBaseHt: roundMoney(salesBaseHt),
      salesTotalTtc: roundMoney(salesTotalTtc),
      purchasesBaseHt: roundMoney(purchasesBaseHt),
      purchasesTotalTtc: roundMoney(purchasesTotalTtc),
      creditVat: roundMoney(Math.max(0, preview.summary.deductibleVat - preview.summary.collectedVat)),
      blockingIssuesCount,
      warningIssuesCount,
      controlsCount: controls.length,
      isReady: status === "ready",
      status,
    },
    collectedVatRows,
    deductibleVatRows,
    deductionStatementRows: deductibleVatRows,
    accountingVatRows,
    controls,
    isReady: status === "ready",
  };
}

export function buildDgiVatPreparationCsv(data: DgiVatPreparationData) {
  const headers = [
    "SECTION",
    "PERIODE_DEBUT",
    "PERIODE_FIN",
    "TYPE_PIECE",
    "NUMERO_PIECE",
    "DATE_PIECE",
    "TIERS_NOM",
    "TIERS_ICE",
    "TIERS_IF",
    "BASE_HT",
    "TAUX_TVA",
    "MONTANT_TVA",
    "TOTAL_TTC",
    "STATUT_PIECE",
    "STATUT_COMPTABLE",
    "COMPTE_TVA",
    "OBSERVATION",
  ];
  const rows: unknown[][] = [
    headers,
    [
      "SYNTHESE",
      data.period.start,
      data.period.end,
      "Organisation",
      data.organization.name,
      "",
      data.organization.name,
      data.organization.ice,
      data.organization.ifNumber,
      data.summary.salesBaseHt,
      "",
      data.summary.collectedVat,
      data.summary.salesTotalTtc,
      data.summary.status,
      "",
      "4455",
      "Total base HT ventes / TVA collectée / TTC ventes",
    ],
    [
      "SYNTHESE",
      data.period.start,
      data.period.end,
      "Achats",
      "TVA récupérable",
      "",
      "",
      "",
      "",
      data.summary.purchasesBaseHt,
      "",
      data.summary.deductibleVat,
      data.summary.purchasesTotalTtc,
      data.summary.status,
      "",
      "3455",
      `Solde TVA estimé: ${data.summary.estimatedBalance.toFixed(2)}; Crédit TVA: ${data.summary.creditVat.toFixed(2)}; Alertes: ${data.summary.warningIssuesCount}; Bloquants: ${data.summary.blockingIssuesCount}`,
    ],
  ];

  for (const row of data.collectedVatRows) {
    rows.push([
      "TVA_COLLECTEE",
      data.period.start,
      data.period.end,
      row.documentType,
      row.documentNumber,
      row.documentDate,
      row.thirdPartyName,
      row.thirdPartyIce,
      "",
      row.baseHt.toFixed(2),
      row.taxRate === null ? "" : row.taxRate.toFixed(2),
      row.vatAmount.toFixed(2),
      row.totalTtc.toFixed(2),
      row.documentStatus,
      row.accountingStatus,
      "4455",
      row.observation,
    ]);
  }

  for (const row of data.deductibleVatRows) {
    rows.push([
      "TVA_RECUPERABLE",
      data.period.start,
      data.period.end,
      row.documentType,
      row.documentNumber,
      row.documentDate,
      row.thirdPartyName,
      row.thirdPartyIce,
      "",
      row.baseHt.toFixed(2),
      row.taxRate === null ? "" : row.taxRate.toFixed(2),
      row.vatAmount.toFixed(2),
      row.totalTtc.toFixed(2),
      row.documentStatus,
      row.accountingStatus,
      "3455",
      row.observation,
    ]);
    rows.push([
      "RELEVE_DEDUCTIONS",
      data.period.start,
      data.period.end,
      "Facture fournisseur",
      row.documentNumber,
      row.documentDate,
      row.thirdPartyName,
      row.thirdPartyIce,
      "",
      row.baseHt.toFixed(2),
      row.taxRate === null ? "" : row.taxRate.toFixed(2),
      row.vatAmount.toFixed(2),
      row.totalTtc.toFixed(2),
      row.documentStatus,
      row.accountingStatus,
      "3455",
      row.observation ?? "Relevé préparatoire des déductions.",
    ]);
  }

  for (const row of data.accountingVatRows) {
    rows.push([
      row.documentType.includes("collectée") ? "TVA_COLLECTEE" : "TVA_RECUPERABLE",
      data.period.start,
      data.period.end,
      row.documentType,
      row.documentNumber,
      row.documentDate,
      "",
      "",
      "",
      "",
      "",
      row.vatAmount.toFixed(2),
      "",
      row.documentStatus,
      row.accountingStatus,
      row.documentType.includes("collectée") ? "4455" : "3455",
      row.observation,
    ]);
  }

  for (const control of data.controls) {
    rows.push([
      "CONTROLES",
      data.period.start,
      data.period.end,
      control.label,
      control.key,
      "",
      "",
      "",
      "",
      "",
      "",
      control.count,
      "",
      control.severity,
      "",
      "",
      control.message,
    ]);
  }

  return `\uFEFF${rows.map(dgiCsvRow).join("\n")}`;
}

export async function recordVatExportBatch(preview: VatExportPreview, format: "csv" | "excel" | "dgi", fileName: string) {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const now = new Date();
  const exportNumber = `TVA-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(now.getTime()).slice(-6)}`;

  const { error } = await supabase
    .from("tax_export_batches")
    .insert({
      organization_id: preview.organization.id,
      export_number: exportNumber,
      export_type: String(preview.filters.type ?? "summary"),
      period_start: preview.filters.from ?? null,
      period_end: preview.filters.to ?? null,
      format,
      status: "generated",
      file_name: fileName,
      generated_by: workspace.userId,
      notes: `${preview.rows.length} ligne(s), ${preview.summary.warningIssuesCount} anomalie(s) d'attention.`,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, exportNumber };
}
