import type { SupabaseClient } from "@supabase/supabase-js";
import { roundMad } from "@/lib/tax/dgi-vat-mapping";
import { countedPayment, linkAllocationPayments, type AllocationPaymentLink, type DeductionInvoice } from "@/lib/tax/vat-deduction-report";
import { casablancaIsoDate, resolveUnallocatedPayments, selectPurchaseDeduction, type PurchaseCandidate, type UnallocatedSupplierPayment, type VatRegimeMode } from "@/lib/tax/vat-period-rules";
import { createClient } from "@/lib/supabase/server";

type PaymentRow = { id?: string | null; payment_date?: string | null; payment_method?: string | null; status?: string | null; reference?: string | null };
type AllocationRow = { invoice_id?: string | null; payment_id?: string | null; amount?: number | null; allocation_date?: string | null };

/** Two reads. The live schema has payment_id and invoice_id without a foreign key, so an embed on payment_id is rejected. */
export async function loadSupplierAllocationPayments(supabase: SupabaseClient, organizationId: string, invoiceIds: string[]): Promise<AllocationPaymentLink[]> {
  if (invoiceIds.length === 0) return [];
  const allocations = await supabase
    .from("supplier_payment_allocations")
    .select("invoice_id, payment_id, amount, allocation_date")
    .eq("organization_id", organizationId)
    .in("invoice_id", invoiceIds)
    .is("cancelled_at", null);
  if (allocations.error) throw new Error(allocations.error.message);
  const rows = (allocations.data ?? []) as AllocationRow[];
  const paymentIds = [...new Set(rows.map((row) => row.payment_id).filter((id): id is string => Boolean(id)))];
  const payments = paymentIds.length
    ? await supabase.from("supplier_payments").select("id, payment_date, payment_method, status, reference").eq("organization_id", organizationId).in("id", paymentIds)
    : { data: [] as PaymentRow[], error: null };
  if (payments.error) throw new Error(payments.error.message);
  return linkAllocationPayments(rows, (payments.data ?? []) as PaymentRow[]);
}

type Party = { id?: string | null; name?: string | null; ice?: string | null; if_number?: string | null };
type LineRow = { invoice_id?: string; credit_note_id?: string; description?: string | null; subtotal_ht?: number | null; tax_rate?: number | null; tax_amount?: number | null; total_ttc?: number | null };

function partyOf(value: unknown): Party | null {
  if (Array.isArray(value)) return (value[0] ?? null) as Party | null;
  return (value ?? null) as Party | null;
}

function finiteRate(value: unknown) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  const rate = Number(value);
  return Number.isFinite(rate) ? roundMad(rate) : Number.NaN;
}

function rateLines(rows: LineRow[], header: Record<string, unknown>) {
  if (rows.length > 0) {
    return rows.map((line) => ({
      taxRate: finiteRate(line.tax_rate),
      baseHt: roundMad(Number(line.subtotal_ht ?? 0)),
      vat: roundMad(Number(line.tax_amount ?? 0)),
      ttc: roundMad(Number(line.total_ttc ?? 0)),
    }));
  }
  const baseHt = roundMad(Number(header.subtotal_ht ?? 0));
  const vat = roundMad(Number(header.tax_total ?? 0));
  const ttc = roundMad(Number(header.total_ttc ?? baseHt + vat));
  const taxRate = baseHt ? roundMad((vat / baseHt) * 100) : 0;
  return [{ taxRate, baseHt, vat, ttc }];
}

function markedFixedAsset(texts: Array<string | null | undefined>) {
  return texts.some((text) => /immobilisation/i.test(String(text ?? "")));
}

export type DeductiblePurchaseRow = {
  id: string;
  documentType: "INVOICE" | "CREDIT_NOTE";
  referenceNumber: string;
  issueDate: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierIf: string | null;
  supplierIce: string | null;
  description: string | null;
  currency: string;
  paymentMode: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  taxBreakdown: Array<{ taxRate: number; baseHtMad: number; vatOnInvoiceMad: number; deductibleVatMad: number }>;
  totalTtcMad: number;
  paidAmountMad: number;
  fixedAsset: boolean;
  accountingStatus: "posted" | "not_posted";
  status: string | null;
  statementHt: number;
  statementVat: number;
  prorata: number;
};

export type UnallocatedPaymentNotice = {
  invoiceId: string;
  invoiceNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  paidAmount: number;
  deducted: boolean;
};

const INVOICE_SELECT = "id, invoice_number, supplier_invoice_number, invoice_date, status, payment_status, paid_amount, subtotal_ht, tax_total, total_ttc, currency, notes, internal_notes, supplier:supplier_id(id, name, ice, if_number)";

/** Achats déductibles de la période. Le prorata vient des règlements datés dans la période, sauf en régime débit. */
export async function loadDeductiblePurchases(
  supabase: SupabaseClient,
  organizationId: string,
  from: string,
  to: string,
  regime: VatRegimeMode = "unspecified",
): Promise<{ rows: DeductiblePurchaseRow[]; unallocatedPayments: UnallocatedPaymentNotice[] }> {
  const periodPayments = await supabase
    .from("supplier_payments")
    .select("id, payment_date, payment_method, status, reference")
    .eq("organization_id", organizationId)
    .gte("payment_date", from)
    .lte("payment_date", to)
    .is("archived_at", null)
    .limit(5000);
  if (periodPayments.error) throw new Error(periodPayments.error.message);
  const countedIds = ((periodPayments.data ?? []) as PaymentRow[])
    .filter((payment) => countedPayment(payment.status) && payment.id)
    .map((payment) => String(payment.id));
  const periodAllocations = countedIds.length
    ? await supabase.from("supplier_payment_allocations").select("invoice_id").eq("organization_id", organizationId).in("payment_id", countedIds).is("cancelled_at", null)
    : { data: [] as Array<{ invoice_id?: string | null }>, error: null };
  if (periodAllocations.error) throw new Error(periodAllocations.error.message);
  const paidInvoiceIds = [...new Set((periodAllocations.data ?? []).map((row) => row.invoice_id).filter((id): id is string => Boolean(id)))];

  let invoiceQuery = supabase
    .from("supplier_invoices")
    .select(INVOICE_SELECT)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .not("status", "in", "(draft,cancelled)")
    .order("invoice_date", { ascending: true })
    .limit(2000);
  invoiceQuery = paidInvoiceIds.length
    ? invoiceQuery.or(`and(invoice_date.gte.${from},invoice_date.lte.${to}),id.in.(${paidInvoiceIds.join(",")})`)
    : invoiceQuery.gte("invoice_date", from).lte("invoice_date", to);
  const [invoices, creditNotes] = await Promise.all([
    invoiceQuery,
    supabase
      .from("supplier_credit_notes")
      .select("id, credit_note_number, supplier_credit_note_number, credit_note_date, status, subtotal_ht, tax_total, total_ttc, currency, notes, internal_notes, supplier:supplier_id(id, name, ice, if_number)")
      .eq("organization_id", organizationId)
      .in("status", ["validated", "applied", "partially_applied"])
      .is("archived_at", null)
      .gte("credit_note_date", from)
      .lte("credit_note_date", to)
      .order("credit_note_date", { ascending: true })
      .limit(2000),
  ]);
  if (invoices.error) throw new Error(invoices.error.message);
  if (creditNotes.error) throw new Error(creditNotes.error.message);
  const markedPaid = await supabase
    .from("supplier_invoices")
    .select(INVOICE_SELECT)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .not("status", "in", "(draft,cancelled)")
    .gt("paid_amount", 0)
    .order("invoice_date", { ascending: true })
    .limit(2000);
  if (markedPaid.error) throw new Error(markedPaid.error.message);

  const invoiceRows = mergeInvoices((invoices.data ?? []) as Array<Record<string, unknown>>, (markedPaid.data ?? []) as Array<Record<string, unknown>>);
  const creditRows = (creditNotes.data ?? []) as Array<Record<string, unknown>>;
  const invoiceIds = invoiceRows.map((row) => String(row.id));
  const creditIds = creditRows.map((row) => String(row.id));
  const [links, invoiceLines, creditLines, accounts] = await Promise.all([
    loadSupplierAllocationPayments(supabase, organizationId, invoiceIds),
    invoiceIds.length
      ? supabase.from("supplier_invoice_lines").select("invoice_id, description, subtotal_ht, tax_rate, tax_amount, total_ttc").eq("organization_id", organizationId).in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as LineRow[], error: null }),
    creditIds.length
      ? supabase.from("supplier_credit_note_lines").select("credit_note_id, description, subtotal_ht, tax_rate, tax_amount, total_ttc").eq("organization_id", organizationId).in("credit_note_id", creditIds)
      : Promise.resolve({ data: [] as LineRow[], error: null }),
    loadAccountCodes(supabase, organizationId, [
      ...invoiceIds.map((id) => ({ id, type: "supplier_invoice" })),
      ...creditIds.map((id) => ({ id, type: "supplier_credit_note" })),
    ]),
  ]);
  if (invoiceLines.error) throw new Error(invoiceLines.error.message);
  if (creditLines.error) throw new Error(creditLines.error.message);

  const linesByInvoice = groupLines((invoiceLines.data ?? []) as LineRow[], "invoice_id");
  const linesByCredit = groupLines((creditLines.data ?? []) as LineRow[], "credit_note_id");
  const paymentsByInvoice = new Map<string, PurchaseCandidate["payments"]>();
  for (const link of links) {
    if (!countedPayment(link.payment?.status)) continue;
    const date = casablancaIsoDate(String(link.payment?.date ?? link.allocationDate ?? ""));
    if (!date) continue;
    const list = paymentsByInvoice.get(link.invoiceId) ?? [];
    list.push({ date, amount: Number(link.amount ?? 0), mode: link.payment?.mode ?? null, reference: link.payment?.reference ?? null });
    paymentsByInvoice.set(link.invoiceId, list);
  }

  const openPayments = await supabase
    .from("supplier_payments")
    .select("id, supplier_id, payment_date, payment_method, status, reference, amount, available_amount")
    .eq("organization_id", organizationId)
    .gt("available_amount", 0)
    .is("archived_at", null)
    .limit(5000);
  if (openPayments.error) throw new Error(openPayments.error.message);
  const pool: UnallocatedSupplierPayment[] = ((openPayments.data ?? []) as Array<Record<string, unknown>>)
    .filter((payment) => countedPayment(text(payment.status)) && payment.id && payment.supplier_id)
    .map((payment) => ({
      id: String(payment.id),
      supplierId: String(payment.supplier_id),
      date: casablancaIsoDate(text(payment.payment_date)),
      amount: Number(payment.available_amount ?? payment.amount ?? 0),
      mode: text(payment.payment_method),
      reference: text(payment.reference),
    }));
  const resolvedPayments = new Map(resolveUnallocatedPayments(invoiceRows.map((row) => ({
    id: String(row.id),
    supplierId: partyOf(row.supplier)?.id ?? null,
    allocations: paymentsByInvoice.get(String(row.id)) ?? [],
    paidAmount: Number(row.paid_amount ?? 0),
    status: text(row.status),
    paymentStatus: text(row.payment_status),
  })), pool).map((item) => [item.id, item]));

  const selected: DeductiblePurchaseRow[] = [];
  const unallocatedPayments: UnallocatedPaymentNotice[] = [];
  for (const row of invoiceRows) {
    const supplier = partyOf(row.supplier);
    const id = String(row.id);
    const lines = linesByInvoice.get(id) ?? [];
    const before = selected.length;
    selected.push(...toRows({
      id,
      documentType: "INVOICE",
      number: String(row.supplier_invoice_number || row.invoice_number || ""),
      invoiceDate: casablancaIsoDate(String(row.invoice_date ?? "")),
      supplierName: supplier?.name ?? null,
      supplierIf: supplier?.if_number ?? null,
      supplierIce: supplier?.ice ?? null,
      description: text(row.notes) ?? text(lines[0]?.description),
      totalTtc: Number(row.total_ttc ?? 0),
      lines: rateLines(lines, row),
      payments: resolvedPayments.get(id)?.payments ?? [],
      accountCodes: accounts.codes.get(id) ?? [],
      markedFixedAsset: markedFixedAsset([text(row.notes), text(row.internal_notes), ...lines.map((line) => line.description)]),
    }, { start: from, end: to }, regime, {
      supplierId: supplier?.id ?? null,
      currency: String(row.currency ?? "MAD"),
      status: text(row.status),
      posted: accounts.posted.has(`supplier_invoice:${id}`),
      fullTtc: Number(row.total_ttc ?? 0),
    }));
    if (resolvedPayments.get(id)?.unallocated) {
      unallocatedPayments.push({
        invoiceId: id,
        invoiceNumber: String(row.supplier_invoice_number || row.invoice_number || ""),
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? null,
        paidAmount: Number(row.paid_amount ?? 0),
        deducted: selected.length > before,
      });
    }
  }
  for (const row of creditRows) {
    const supplier = partyOf(row.supplier);
    const id = String(row.id);
    const lines = linesByCredit.get(id) ?? [];
    selected.push(...toRows({
      id,
      documentType: "CREDIT_NOTE",
      number: String(row.supplier_credit_note_number || row.credit_note_number || ""),
      invoiceDate: casablancaIsoDate(String(row.credit_note_date ?? "")),
      supplierName: supplier?.name ?? null,
      supplierIf: supplier?.if_number ?? null,
      supplierIce: supplier?.ice ?? null,
      description: text(row.notes) ?? text(lines[0]?.description),
      totalTtc: Number(row.total_ttc ?? 0),
      lines: rateLines(lines, row),
      payments: [],
      accountCodes: accounts.codes.get(id) ?? [],
      markedFixedAsset: markedFixedAsset([text(row.notes), text(row.internal_notes), ...lines.map((line) => line.description)]),
    }, { start: from, end: to }, regime, {
      supplierId: supplier?.id ?? null,
      currency: String(row.currency ?? "MAD"),
      status: text(row.status),
      posted: accounts.posted.has(`supplier_credit_note:${id}`),
      fullTtc: Number(row.total_ttc ?? 0),
    }));
  }
  return { rows: selected, unallocatedPayments };
}

function mergeInvoices(primary: Array<Record<string, unknown>>, extra: Array<Record<string, unknown>>) {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...primary, ...extra]) byId.set(String(row.id), row);
  return [...byId.values()];
}

export async function loadVatDeductionInvoices(organizationId: string, from: string, to: string, regime: VatRegimeMode = "unspecified"): Promise<DeductionInvoice[]> {
  const supabase = await createClient();
  const purchases = await loadDeductiblePurchases(supabase, organizationId, from, to, regime);
  return purchases.rows.map((purchase) => ({
    supplier: purchase.supplierName || "Fournisseur",
    ifNumber: purchase.supplierIf,
    ice: purchase.supplierIce,
    invoiceNumber: purchase.referenceNumber,
    invoiceDate: purchase.issueDate || null,
    amountHt: purchase.statementHt,
    vatAmount: purchase.statementVat,
    payments: purchase.paymentDate ? [{ date: purchase.paymentDate, mode: purchase.paymentMode }] : [],
    nature: purchase.fixedAsset ? "Immobilisation" : "Charge",
  }));
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function groupLines(rows: LineRow[], key: "invoice_id" | "credit_note_id") {
  const grouped = new Map<string, LineRow[]>();
  for (const row of rows) {
    const id = String(row[key] ?? "");
    if (!id) continue;
    const list = grouped.get(id) ?? [];
    list.push(row);
    grouped.set(id, list);
  }
  return grouped;
}

async function loadAccountCodes(supabase: SupabaseClient, organizationId: string, documents: Array<{ id: string; type: string }>) {
  const codes = new Map<string, string[]>();
  const posted = new Set<string>();
  if (documents.length === 0) return { codes, posted };
  const entries = await supabase
    .from("accounting_entries")
    .select("id, source_document_id, source_document_type")
    .eq("organization_id", organizationId)
    .eq("status", "posted")
    .in("source_document_id", documents.map((document) => document.id))
    .in("source_document_type", ["supplier_invoice", "supplier_credit_note"]);
  if (entries.error) throw new Error(entries.error.message);
  const entryRows = (entries.data ?? []) as Array<{ id: string; source_document_id: string; source_document_type: string }>;
  for (const entry of entryRows) posted.add(`${entry.source_document_type}:${entry.source_document_id}`);
  const entryIds = entryRows.map((entry) => entry.id);
  if (entryIds.length === 0) return { codes, posted };
  const lines = await supabase.from("accounting_entry_lines").select("entry_id, account_code").eq("organization_id", organizationId).in("entry_id", entryIds);
  if (lines.error) throw new Error(lines.error.message);
  const byEntry = new Map(entryRows.map((entry) => [entry.id, entry.source_document_id]));
  for (const line of (lines.data ?? []) as Array<{ entry_id: string; account_code: string | null }>) {
    const documentId = byEntry.get(line.entry_id);
    if (!documentId || !line.account_code) continue;
    const list = codes.get(documentId) ?? [];
    list.push(line.account_code);
    codes.set(documentId, list);
  }
  return { codes, posted };
}

function toRows(
  candidate: PurchaseCandidate,
  period: { start: string; end: string },
  regime: VatRegimeMode,
  extra: { supplierId: string | null; currency: string; status: string | null; posted: boolean; fullTtc: number },
): DeductiblePurchaseRow[] {
  const deduction = selectPurchaseDeduction(candidate, period, regime);
  if (!deduction.included) return [];
  return [{
    id: candidate.id,
    documentType: candidate.documentType,
    referenceNumber: candidate.number,
    issueDate: candidate.invoiceDate,
    supplierId: extra.supplierId,
    supplierName: candidate.supplierName,
    supplierIf: candidate.supplierIf,
    supplierIce: candidate.supplierIce,
    description: candidate.description,
    currency: extra.currency,
    paymentMode: deduction.paymentMode,
    paymentReference: deduction.paymentReference,
    paymentDate: deduction.paymentDate,
    taxBreakdown: deduction.lines.map((line) => ({
      taxRate: line.taxRate,
      baseHtMad: line.baseHt,
      vatOnInvoiceMad: line.vatOnInvoice,
      deductibleVatMad: line.deductibleVat,
    })),
    totalTtcMad: roundMad(extra.fullTtc * (candidate.documentType === "CREDIT_NOTE" ? -1 : 1)),
    paidAmountMad: deduction.paidInPeriod,
    fixedAsset: deduction.fixedAsset,
    accountingStatus: extra.posted ? "posted" : "not_posted",
    status: extra.status,
    statementHt: deduction.baseHt,
    statementVat: deduction.deductibleVat,
    prorata: deduction.prorata,
  }];
}
