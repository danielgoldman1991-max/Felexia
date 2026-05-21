import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { buildDeclarationLines, DGI_VAT_SCHEMA_VERSION, roundMad, toMadAmount } from "@/lib/tax/dgi-vat-mapping";
import type {
  DgiVatExportData,
  DgiVatPurchaseDocument,
  DgiVatSalesDocument,
  DgiVatTaxBreakdown,
  VatFrequency,
} from "@/lib/tax/dgi-vat-types";

type RecordLike = Record<string, unknown>;

type QueryOptions = {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  frequency: VatFrequency;
  generatedBy: string;
  priorCreditMad?: number;
};

const SALES_STATUSES = ["validated", "sent", "partially_paid", "paid", "overdue"];
const PURCHASE_STATUSES = ["validated", "partially_paid", "paid"];
const CREDIT_NOTE_STATUSES = ["validated", "applied", "partially_applied"];

function rowObject(value: unknown): RecordLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RecordLike;
}

function relationObject(value: unknown): RecordLike | null {
  if (Array.isArray(value)) return rowObject(value[0]);
  return rowObject(value);
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateValue(value: unknown) {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "";
}

function buildTaxBreakdown(lines: RecordLike[], sign = 1): DgiVatTaxBreakdown[] {
  if (lines.length === 0) return [];

  const grouped = new Map<number, DgiVatTaxBreakdown>();
  for (const line of lines) {
    const taxRate = toMadAmount(line.tax_rate);
    const current = grouped.get(taxRate) ?? { taxRate, baseHtMad: 0, vatAmountMad: 0, totalTtcMad: 0 };
    current.baseHtMad += sign * toMadAmount(line.subtotal_ht);
    current.vatAmountMad += sign * toMadAmount(line.tax_amount);
    current.totalTtcMad = (current.totalTtcMad ?? 0) + sign * toMadAmount(line.total_ttc);
    grouped.set(taxRate, current);
  }

  return [...grouped.values()].map((row) => ({
    taxRate: roundMad(row.taxRate),
    baseHtMad: roundMad(row.baseHtMad),
    vatAmountMad: roundMad(row.vatAmountMad),
    totalTtcMad: roundMad(row.totalTtcMad ?? 0),
  }));
}

function buildPurchaseTaxBreakdown(lines: RecordLike[], prorata: number) {
  return buildTaxBreakdown(lines).map((row) => ({
    taxRate: row.taxRate,
    baseHtMad: row.baseHtMad,
    vatOnInvoiceMad: row.vatAmountMad,
    deductibleVatMad: roundMad(row.vatAmountMad * prorata),
  }));
}

function snapshotHash(payload: unknown) {
  return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

async function getPostedDocumentIds(organizationId: string, sourceType: "customer_invoice" | "supplier_invoice" | "credit_note", ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_entries")
    .select("source_document_id")
    .eq("organization_id", organizationId)
    .eq("source_document_type", sourceType)
    .in("source_document_id", ids)
    .eq("status", "posted");

  return new Set((data ?? []).map((row) => String(row.source_document_id)));
}

export async function getDgiVatExportData({
  organizationId,
  periodStart,
  periodEnd,
  frequency,
  priorCreditMad = 0,
}: QueryOptions): Promise<DgiVatExportData> {
  const supabase = await createClient();

  const [
    { data: organization },
    { data: companySettings },
    { data: customerInvoices },
    { data: customerCreditNotes },
    { data: supplierInvoices },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, legal_name, ice, if_number, currency, address, city")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("legal_name, ice, if_number, currency, address, city, country")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("customer_invoices")
      .select("id, invoice_number, invoice_date, status, subtotal_ht, tax_total, total_ttc, currency, customer:customer_id(name, ice, if_number)")
      .eq("organization_id", organizationId)
      .in("status", SALES_STATUSES)
      .is("archived_at", null)
      .gte("invoice_date", periodStart)
      .lte("invoice_date", periodEnd)
      .order("invoice_date", { ascending: true }),
    supabase
      .from("customer_credit_notes")
      .select("id, credit_note_number, credit_note_date, status, subtotal_ht, tax_total, total_ttc, currency, source_invoice_id, customer:customer_id(name, ice, if_number), source_invoice:source_invoice_id(invoice_number)")
      .eq("organization_id", organizationId)
      .in("status", CREDIT_NOTE_STATUSES)
      .is("archived_at", null)
      .gte("credit_note_date", periodStart)
      .lte("credit_note_date", periodEnd)
      .order("credit_note_date", { ascending: true }),
    supabase
      .from("supplier_invoices")
      .select("id, invoice_number, supplier_invoice_number, invoice_date, status, subtotal_ht, tax_total, total_ttc, paid_amount, currency, notes, supplier:supplier_id(name, ice, if_number)")
      .eq("organization_id", organizationId)
      .in("status", PURCHASE_STATUSES)
      .is("archived_at", null)
      .gte("invoice_date", periodStart)
      .lte("invoice_date", periodEnd)
      .order("invoice_date", { ascending: true }),
  ]);

  const customerInvoiceRows = (customerInvoices ?? []) as RecordLike[];
  const creditNoteRows = (customerCreditNotes ?? []) as RecordLike[];
  const supplierInvoiceRows = (supplierInvoices ?? []) as RecordLike[];

  const customerInvoiceIds = customerInvoiceRows.map((row) => String(row.id));
  const creditNoteIds = creditNoteRows.map((row) => String(row.id));
  const supplierInvoiceIds = supplierInvoiceRows.map((row) => String(row.id));

  const [
    { data: customerLines },
    { data: creditNoteLines },
    { data: supplierLines },
    { data: paymentAllocations },
    customerPostedIds,
    creditNotePostedIds,
    supplierPostedIds,
  ] = await Promise.all([
    customerInvoiceIds.length
      ? supabase
          .from("customer_invoice_lines")
          .select("invoice_id, subtotal_ht, tax_rate, tax_amount, total_ttc")
          .eq("organization_id", organizationId)
          .in("invoice_id", customerInvoiceIds)
      : Promise.resolve({ data: [] }),
    creditNoteIds.length
      ? supabase
          .from("customer_credit_note_lines")
          .select("credit_note_id, subtotal_ht, tax_rate, tax_amount, total_ttc")
          .eq("organization_id", organizationId)
          .in("credit_note_id", creditNoteIds)
      : Promise.resolve({ data: [] }),
    supplierInvoiceIds.length
      ? supabase
          .from("supplier_invoice_lines")
          .select("invoice_id, description, subtotal_ht, tax_rate, tax_amount, total_ttc")
          .eq("organization_id", organizationId)
          .in("invoice_id", supplierInvoiceIds)
      : Promise.resolve({ data: [] }),
    supplierInvoiceIds.length
      ? supabase
          .from("supplier_payment_allocations")
          .select("invoice_id, amount, allocation_date, payment:payment_id(payment_date, payment_method, reference, status)")
          .eq("organization_id", organizationId)
          .in("invoice_id", supplierInvoiceIds)
          .is("cancelled_at", null)
      : Promise.resolve({ data: [] }),
    getPostedDocumentIds(organizationId, "customer_invoice", customerInvoiceIds),
    getPostedDocumentIds(organizationId, "credit_note", creditNoteIds),
    getPostedDocumentIds(organizationId, "supplier_invoice", supplierInvoiceIds),
  ]);

  const customerLinesByInvoice = new Map<string, RecordLike[]>();
  for (const line of (customerLines ?? []) as RecordLike[]) {
    const list = customerLinesByInvoice.get(String(line.invoice_id)) ?? [];
    list.push(line);
    customerLinesByInvoice.set(String(line.invoice_id), list);
  }

  const creditNoteLinesByNote = new Map<string, RecordLike[]>();
  for (const line of (creditNoteLines ?? []) as RecordLike[]) {
    const list = creditNoteLinesByNote.get(String(line.credit_note_id)) ?? [];
    list.push(line);
    creditNoteLinesByNote.set(String(line.credit_note_id), list);
  }

  const supplierLinesByInvoice = new Map<string, RecordLike[]>();
  for (const line of (supplierLines ?? []) as RecordLike[]) {
    const list = supplierLinesByInvoice.get(String(line.invoice_id)) ?? [];
    list.push(line);
    supplierLinesByInvoice.set(String(line.invoice_id), list);
  }

  const paymentByInvoice = new Map<string, { paid: number; mode: string | null; reference: string | null; date: string | null }>();
  for (const allocation of (paymentAllocations ?? []) as RecordLike[]) {
    const invoiceId = String(allocation.invoice_id);
    const current = paymentByInvoice.get(invoiceId) ?? { paid: 0, mode: null, reference: null, date: null };
    const payment = relationObject(allocation.payment);
    current.paid += toMadAmount(allocation.amount);
    current.mode = current.mode ?? textValue(payment?.payment_method);
    current.reference = current.reference ?? textValue(payment?.reference);
    current.date = current.date ?? (dateValue(payment?.payment_date) || dateValue(allocation.allocation_date) || null);
    paymentByInvoice.set(invoiceId, current);
  }

  const salesDocuments: DgiVatSalesDocument[] = [
    ...customerInvoiceRows.map((invoice) => {
      const customer = relationObject(invoice.customer);
      const lines = customerLinesByInvoice.get(String(invoice.id)) ?? [];
      const taxBreakdown = buildTaxBreakdown(lines.length ? lines : [{
        subtotal_ht: invoice.subtotal_ht,
        tax_rate: null,
        tax_amount: invoice.tax_total,
        total_ttc: invoice.total_ttc,
      }]);
      return {
        id: String(invoice.id),
        documentType: "INVOICE" as const,
        invoiceNumber: textValue(invoice.invoice_number) ?? "",
        issueDate: dateValue(invoice.invoice_date),
        customerId: textValue(customer?.id) ?? null,
        customerName: textValue(customer?.name),
        customerIf: textValue(customer?.if_number),
        customerIce: textValue(customer?.ice),
        currencySource: textValue(invoice.currency) ?? "MAD",
        exchangeRateToMad: textValue(invoice.currency) && textValue(invoice.currency) !== "MAD" ? null : 1,
        taxBreakdown,
        totalTtcMad: toMadAmount(invoice.total_ttc),
        status: textValue(invoice.status),
        accountingStatus: customerPostedIds.has(String(invoice.id)) ? "posted" as const : "not_posted" as const,
      };
    }),
    ...creditNoteRows.map((note) => {
      const customer = relationObject(note.customer);
      const sourceInvoice = relationObject(note.source_invoice);
      const lines = creditNoteLinesByNote.get(String(note.id)) ?? [];
      const taxBreakdown = buildTaxBreakdown(lines.length ? lines : [{
        subtotal_ht: note.subtotal_ht,
        tax_rate: null,
        tax_amount: note.tax_total,
        total_ttc: note.total_ttc,
      }], -1);
      return {
        id: String(note.id),
        documentType: "CREDIT_NOTE" as const,
        invoiceNumber: textValue(note.credit_note_number) ?? "",
        originalInvoiceNumber: textValue(sourceInvoice?.invoice_number),
        issueDate: dateValue(note.credit_note_date),
        customerId: textValue(customer?.id) ?? null,
        customerName: textValue(customer?.name),
        customerIf: textValue(customer?.if_number),
        customerIce: textValue(customer?.ice),
        currencySource: textValue(note.currency) ?? "MAD",
        exchangeRateToMad: textValue(note.currency) && textValue(note.currency) !== "MAD" ? null : 1,
        taxBreakdown,
        totalTtcMad: -toMadAmount(note.total_ttc),
        status: textValue(note.status),
        accountingStatus: creditNotePostedIds.has(String(note.id)) ? "posted" as const : "not_posted" as const,
      };
    }),
  ];

  const purchaseDocuments: DgiVatPurchaseDocument[] = supplierInvoiceRows.map((invoice) => {
    const supplier = relationObject(invoice.supplier);
    const invoiceId = String(invoice.id);
    const payment = paymentByInvoice.get(invoiceId);
    const totalTtc = toMadAmount(invoice.total_ttc);
    const paid = Math.max(payment?.paid ?? toMadAmount(invoice.paid_amount), 0);
    const prorata = totalTtc > 0 ? Math.min(paid / totalTtc, 1) : 0;
    const lines = supplierLinesByInvoice.get(invoiceId) ?? [];

    return {
      id: invoiceId,
      documentType: "INVOICE",
      referenceNumber: textValue(invoice.supplier_invoice_number) ?? textValue(invoice.invoice_number) ?? "",
      issueDate: dateValue(invoice.invoice_date),
      supplierId: textValue(supplier?.id) ?? null,
      supplierName: textValue(supplier?.name),
      supplierIf: textValue(supplier?.if_number),
      supplierIce: textValue(supplier?.ice),
      description: textValue(invoice.notes) ?? textValue(lines[0]?.description),
      currencySource: textValue(invoice.currency) ?? "MAD",
      exchangeRateToMad: textValue(invoice.currency) && textValue(invoice.currency) !== "MAD" ? null : 1,
      paymentMode: payment?.mode ?? null,
      paymentReference: payment?.reference ?? null,
      paymentDate: payment?.date ?? null,
      taxBreakdown: buildPurchaseTaxBreakdown(lines.length ? lines : [{
        subtotal_ht: invoice.subtotal_ht,
        tax_rate: null,
        tax_amount: invoice.tax_total,
        total_ttc: invoice.total_ttc,
      }], prorata),
      totalTtcMad: totalTtc,
      paidAmountMad: roundMad(paid),
      importFlag: false,
      immobilizationFlag: false,
      status: textValue(invoice.status),
      accountingStatus: supplierPostedIds.has(invoiceId) ? "posted" : "not_posted",
    };
  });

  const allSalesBreakdowns = salesDocuments.flatMap((document) => document.taxBreakdown);
  const collectedVatMad = roundMad(allSalesBreakdowns.reduce((sum, row) => sum + row.vatAmountMad, 0));
  const deductibleVatMad = roundMad(purchaseDocuments.flatMap((doc) => doc.taxBreakdown).reduce((sum, row) => sum + row.deductibleVatMad, 0));
  const totalTurnoverMad = roundMad(allSalesBreakdowns.reduce((sum, row) => sum + row.baseHtMad, 0));
  const taxableTurnoverMad = roundMad(allSalesBreakdowns.filter((row) => row.taxRate > 0).reduce((sum, row) => sum + row.baseHtMad, 0));
  const vatDueMad = Math.max(roundMad(collectedVatMad - deductibleVatMad - priorCreditMad), 0);
  const creditCarryForwardMad = Math.max(roundMad(deductibleVatMad + priorCreditMad - collectedVatMad), 0);

  const declarationLines = buildDeclarationLines({
    salesBreakdowns: allSalesBreakdowns,
    collectedVatMad,
    deductibleVatMad,
    vatDueMad,
    creditCarryForwardMad,
  });

  const company = rowObject(companySettings);
  const org = rowObject(organization);
  const sourceSnapshotHash = snapshotHash({
    organizationId,
    periodStart,
    periodEnd,
    frequency,
    priorCreditMad,
    salesDocuments,
    purchaseDocuments,
    declarationLines,
  });

  return {
    batchId: randomUUID(),
    generatedAt: new Date().toISOString(),
    schemaVersion: DGI_VAT_SCHEMA_VERSION,
    sourceSnapshotHash,
    organization: {
      id: organizationId,
      name: textValue(org?.name) ?? "Organisation",
      legalName: textValue(company?.legal_name) ?? textValue(org?.legal_name),
      ifNumber: textValue(company?.if_number) ?? textValue(org?.if_number),
      ice: textValue(company?.ice) ?? textValue(org?.ice),
      currency: textValue(company?.currency) ?? textValue(org?.currency) ?? "MAD",
      address: textValue(company?.address) ?? textValue(org?.address),
      city: textValue(company?.city) ?? textValue(org?.city),
      countryCode: textValue(company?.country) ?? "MA",
    },
    period: {
      startDate: periodStart,
      endDate: periodEnd,
      frequency,
      regime: "unspecified",
    },
    declarationLines,
    salesDocuments,
    purchaseDocuments,
    summary: {
      priorCreditMad: roundMad(priorCreditMad),
      totalTurnoverMad,
      taxableTurnoverMad,
      collectedVatMad,
      deductibleVatMad,
      vatDueMad,
      creditCarryForwardMad,
      salesCount: salesDocuments.length,
      purchaseCount: purchaseDocuments.length,
      blockingErrorsCount: 0,
      warningsCount: 0,
    },
    validationIssues: [],
  };
}
