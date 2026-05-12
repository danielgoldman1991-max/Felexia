import { requireActiveWorkspace } from "@/lib/auth";
import { calculateInvoiceLine, calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { getCustomerInvoiceDetail, getCustomerInvoiceDocumentFlow, listInvoiceCustomers, listInvoiceProducts, listInvoiceTaxRates, listInvoiceUnits } from "@/lib/invoices";
import { createClient } from "@/lib/supabase/server";
import { getSalesDocumentFlow } from "@/lib/sales";
import type { InvoiceLineFormValue } from "@/lib/invoice-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";
import type {
  CreditNoteApplicationRecord,
  CreditNoteCounters,
  CreditNoteReturnPreparation,
  CreditNoteReturnPreparationLine,
  CustomerCreditNoteDetail,
  CustomerCreditNoteLineRecord,
  CustomerCreditNoteRecord,
} from "@/lib/credit-note-types";

const CREDIT_NOTE_SELECT = `
  id, organization_id, credit_note_number, customer_id, source_invoice_id, source_return_id, source_type,
  credit_note_date, status, subtotal_ht, discount_total, tax_total, total_ttc,
  applied_amount, available_amount, currency, reason, internal_notes, notes,
  validated_at, cancelled_at, created_at, archived_at,
  customer:customer_id(name),
  source_invoice:source_invoice_id(invoice_number),
  source_return:source_return_id(document_number)
`;

const CREDIT_NOTE_LINE_SELECT = `
  id, credit_note_id, source_invoice_line_id, line_order, product_id, product_name,
  description, quantity, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id,
  tax_rate, subtotal_ht, discount_amount, tax_amount, total_ttc
`;

const SALES_LINE_SELECT = `
  id, organization_id, document_id, source_line_id, line_order, product_id, product_name,
  description, quantity, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id,
  tax_rate, subtotal_ht, tax_amount, total_ttc
`;

function objectValue(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function activeOrganizationId() {
  const workspace = await requireActiveWorkspace();
  return workspace.organization.id;
}

function mapCreditNote(row: Record<string, unknown>): CustomerCreditNoteRecord {
  const customer = objectValue(row.customer);
  const invoice = objectValue(row.source_invoice);
  const sourceReturn = objectValue(row.source_return);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    credit_note_number: row.credit_note_number as string,
    customer_id: row.customer_id as string,
    customer_name: customer?.name as string | null,
    source_invoice_id: row.source_invoice_id as string | null,
    source_invoice_number: invoice?.invoice_number as string | null,
    source_return_id: row.source_return_id as string | null,
    source_return_number: sourceReturn?.document_number as string | null,
    source_type: row.source_type as CustomerCreditNoteRecord["source_type"],
    credit_note_date: row.credit_note_date as string,
    status: row.status as CustomerCreditNoteRecord["status"],
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    discount_total: Number(row.discount_total ?? 0),
    tax_total: Number(row.tax_total ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    applied_amount: Number(row.applied_amount ?? 0),
    available_amount: Number(row.available_amount ?? 0),
    currency: row.currency as string,
    reason: row.reason as string | null,
    internal_notes: row.internal_notes as string | null,
    notes: row.notes as string | null,
    validated_at: row.validated_at as string | null,
    cancelled_at: row.cancelled_at as string | null,
    created_at: row.created_at as string,
    archived_at: row.archived_at as string | null,
  };
}

function mapLine(row: Record<string, unknown>): CustomerCreditNoteLineRecord {
  return {
    id: row.id as string,
    credit_note_id: row.credit_note_id as string,
    source_invoice_line_id: row.source_invoice_line_id as string | null,
    line_order: Number(row.line_order ?? 0),
    product_id: row.product_id as string | null,
    product_name: row.product_name as string | null,
    description: row.description as string,
    quantity: Number(row.quantity ?? 0),
    unit_id: row.unit_id as string | null,
    unit_name: row.unit_name as string | null,
    unit_price_ht: Number(row.unit_price_ht ?? 0),
    discount_rate: Number(row.discount_rate ?? 0),
    tax_rate_id: row.tax_rate_id as string | null,
    tax_rate: Number(row.tax_rate ?? 0),
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    discount_amount: Number(row.discount_amount ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
  };
}

function mapApplication(row: Record<string, unknown>): CreditNoteApplicationRecord {
  const invoice = objectValue(row.invoice);
  return {
    id: row.id as string,
    credit_note_id: row.credit_note_id as string,
    invoice_id: row.invoice_id as string,
    invoice_number: invoice?.invoice_number as string | null,
    amount: Number(row.amount ?? 0),
    application_date: row.application_date as string,
    cancelled_at: row.cancelled_at as string | null,
  };
}

export async function listCustomerCreditNotes() {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_credit_notes")
    .select(CREDIT_NOTE_SELECT)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCreditNote(row as Record<string, unknown>));
}

export async function getCustomerCreditNoteDetail(id: string): Promise<CustomerCreditNoteDetail> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const [noteResult, linesResult, applicationsResult] = await Promise.all([
    supabase.from("customer_credit_notes").select(CREDIT_NOTE_SELECT).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    supabase.from("customer_credit_note_lines").select(CREDIT_NOTE_LINE_SELECT).eq("organization_id", organizationId).eq("credit_note_id", id).order("line_order"),
    supabase.from("customer_credit_note_applications").select("id, credit_note_id, invoice_id, amount, application_date, cancelled_at, invoice:invoice_id(invoice_number)").eq("organization_id", organizationId).eq("credit_note_id", id).is("cancelled_at", null),
  ]);
  if (noteResult.error) throw new Error(noteResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);
  if (applicationsResult.error) throw new Error(applicationsResult.error.message);
  return {
    creditNote: noteResult.data ? mapCreditNote(noteResult.data as Record<string, unknown>) : null,
    lines: (linesResult.data ?? []).map((row) => mapLine(row as Record<string, unknown>)),
    applications: (applicationsResult.data ?? []).map((row) => mapApplication(row as Record<string, unknown>)),
  };
}

function creditNoteStep(creditNote: CustomerCreditNoteRecord, isCurrent = true): DocumentFlowStep {
  return {
    label: "Avoir",
    number: creditNote.credit_note_number,
    href: `/facturation/avoirs/${creditNote.id}`,
    status: creditNote.status,
    isCurrent,
    type: "credit_note",
  };
}

export async function getCreditNoteDocumentFlow(creditNoteId: string): Promise<DocumentFlowStep[]> {
  const { creditNote } = await getCustomerCreditNoteDetail(creditNoteId);
  if (!creditNote) return [];

  if (creditNote.source_return_id) {
    const sourceFlow = await getSalesDocumentFlow(creditNote.source_return_id);
    return [...sourceFlow.map((step) => ({ ...step, isCurrent: false })), creditNoteStep(creditNote)];
  }

  if (creditNote.source_invoice_id) {
    const sourceFlow = await getCustomerInvoiceDocumentFlow(creditNote.source_invoice_id);
    return [...sourceFlow.map((step) => ({ ...step, isCurrent: false })), creditNoteStep(creditNote)];
  }

  return [creditNoteStep(creditNote)];
}

export async function getCreditNoteByReturnId(returnId: string): Promise<CustomerCreditNoteRecord | null> {
  if (!returnId) return null;
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_credit_notes")
    .select(CREDIT_NOTE_SELECT)
    .eq("organization_id", organizationId)
    .eq("source_return_id", returnId)
    .neq("status", "cancelled")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCreditNote(data as Record<string, unknown>) : null;
}

export async function getCreditNoteInvoicePreparation(invoiceId: string) {
  const [detail, customers, products, units, taxRates] = await Promise.all([
    getCustomerInvoiceDetail(invoiceId),
    listInvoiceCustomers(),
    listInvoiceProducts(),
    listInvoiceUnits(),
    listInvoiceTaxRates(),
  ]);
  return { ...detail, customers, products, units, taxRates };
}

function salesLineToPricedCreditNoteLine({
  returnLine,
  sourceLine,
  sourceInvoiceLineId,
  sourceLabel,
  priceSource,
}: {
  returnLine: Record<string, unknown>;
  sourceLine: Record<string, unknown> | null;
  sourceInvoiceLineId?: string | null;
  sourceLabel: string | null;
  priceSource: CreditNoteReturnPreparationLine["price_source"];
}): CreditNoteReturnPreparationLine {
  const pricedSource = sourceLine ?? returnLine;
  const line = calculateInvoiceLine({
    id: `return-${returnLine.id}`,
    mode: pricedSource.product_id ? "product" : "free",
    product_id: (pricedSource.product_id as string) ?? "",
    product_name: (pricedSource.product_name as string) ?? "",
    description: (pricedSource.description as string) || (returnLine.description as string) || "",
    quantity: Number(returnLine.quantity ?? 0),
    unit_id: (pricedSource.unit_id as string) ?? "",
    unit_name: (pricedSource.unit_name as string) ?? "",
    unit_price_ht: Number(pricedSource.unit_price_ht ?? 0),
    discount_rate: Number(pricedSource.discount_rate ?? 0),
    tax_rate_id: (pricedSource.tax_rate_id as string) ?? "",
    tax_rate: Number(pricedSource.tax_rate ?? 0),
    subtotal_ht: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_ttc: 0,
    source_line_id: sourceInvoiceLineId ?? null,
    source_document_id: returnLine.document_id as string,
    source_label: sourceLabel,
  });

  return {
    ...line,
    return_line_id: returnLine.id as string,
    source_return_line_id: returnLine.id as string,
    source_invoice_line_id: sourceInvoiceLineId ?? null,
    source_delivery_line_id: (returnLine.source_line_id as string) ?? null,
    quantity_returned: Number(returnLine.quantity ?? 0),
    price_source: priceSource,
  };
}

export async function getCreditNoteReturnPreparation(returnId: string): Promise<CreditNoteReturnPreparation> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data: returnDocument, error: returnError } = await supabase
    .from("sales_documents")
    .select("id, document_number, customer_id, document_type, status, return_reason, related_delivery_id, related_order_id, stock_updated_at, archived_at, customer:customer_id(id, name)")
    .eq("organization_id", organizationId)
    .eq("id", returnId)
    .maybeSingle();
  if (returnError) throw new Error(returnError.message);
  if (!returnDocument || returnDocument.document_type !== "return_note") {
    return { returnDocument: null, customer: null, relatedDelivery: null, relatedOrder: null, relatedInvoice: null, existingCreditNote: null, lines: [] };
  }

  const existingCreditNote = await getCreditNoteByReturnId(returnId);
  const { data: returnLines, error: lineError } = await supabase
    .from("sales_document_lines")
    .select(SALES_LINE_SELECT)
    .eq("organization_id", organizationId)
    .eq("document_id", returnId)
    .order("line_order");
  if (lineError) throw new Error(lineError.message);

  const lines = (returnLines ?? []) as Record<string, unknown>[];
  const deliveryLineIds = Array.from(new Set(lines.map((line) => line.source_line_id).filter(Boolean))) as string[];
  const { data: deliveryLines } = deliveryLineIds.length
    ? await supabase.from("sales_document_lines").select(SALES_LINE_SELECT).eq("organization_id", organizationId).in("id", deliveryLineIds)
    : { data: [] };
  const deliveryLineById = new Map(((deliveryLines ?? []) as Record<string, unknown>[]).map((line) => [line.id as string, line]));

  const orderLineIds = Array.from(new Set(((deliveryLines ?? []) as Record<string, unknown>[]).map((line) => line.source_line_id).filter(Boolean))) as string[];
  const { data: orderLines } = orderLineIds.length
    ? await supabase.from("sales_document_lines").select(SALES_LINE_SELECT).eq("organization_id", organizationId).in("id", orderLineIds)
    : { data: [] };
  const orderLineById = new Map(((orderLines ?? []) as Record<string, unknown>[]).map((line) => [line.id as string, line]));

  const invoiceCandidateLineIds = Array.from(new Set([...deliveryLineIds, ...orderLineIds]));
  const { data: invoiceLines } = invoiceCandidateLineIds.length
    ? await supabase
        .from("customer_invoice_lines")
        .select("id, invoice_id, source_line_id, product_id, product_name, description, quantity, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id, tax_rate, invoice:invoice_id(id, invoice_number, status, customer_id)")
        .eq("organization_id", organizationId)
        .in("source_line_id", invoiceCandidateLineIds)
    : { data: [] };
  const invoiceLineBySourceLineId = new Map<string, Record<string, unknown>>();
  let relatedInvoice: { id: string; invoice_number: string } | null = null;
  for (const invoiceLine of (invoiceLines ?? []) as Record<string, unknown>[]) {
    const invoice = objectValue(invoiceLine.invoice);
    if (!invoice || invoice.status === "cancelled") continue;
    invoiceLineBySourceLineId.set(invoiceLine.source_line_id as string, invoiceLine);
    relatedInvoice ??= { id: invoice.id as string, invoice_number: invoice.invoice_number as string };
  }

  const productIds = Array.from(new Set(lines.map((line) => line.product_id).filter(Boolean))) as string[];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, sale_price_ht, tax_rate_id, tax_rate:tax_rate_id(rate)").eq("organization_id", organizationId).in("id", productIds)
    : { data: [] };
  const productById = new Map(((products ?? []) as Record<string, unknown>[]).map((product) => [product.id as string, product]));

  const relatedIds = [returnDocument.related_delivery_id, returnDocument.related_order_id].filter(Boolean) as string[];
  const { data: relatedDocuments } = relatedIds.length
    ? await supabase.from("sales_documents").select("id, document_number").eq("organization_id", organizationId).in("id", relatedIds)
    : { data: [] };
  const documentById = new Map((relatedDocuments ?? []).map((document) => [document.id as string, document.document_number as string]));

  const preparedLines = lines.map((returnLine) => {
    const deliveryLine = returnLine.source_line_id ? deliveryLineById.get(returnLine.source_line_id as string) ?? null : null;
    const orderLine = deliveryLine?.source_line_id ? orderLineById.get(deliveryLine.source_line_id as string) ?? null : null;
    const invoiceLine = deliveryLine?.id ? invoiceLineBySourceLineId.get(deliveryLine.id as string) : null;
    const invoiceLineFromOrder = orderLine?.id ? invoiceLineBySourceLineId.get(orderLine.id as string) : null;

    if (invoiceLine) return salesLineToPricedCreditNoteLine({ returnLine, sourceLine: invoiceLine, sourceInvoiceLineId: invoiceLine.id as string, sourceLabel: returnDocument.document_number, priceSource: "invoice" });
    if (invoiceLineFromOrder) return salesLineToPricedCreditNoteLine({ returnLine, sourceLine: invoiceLineFromOrder, sourceInvoiceLineId: invoiceLineFromOrder.id as string, sourceLabel: returnDocument.document_number, priceSource: "invoice" });
    if (orderLine) return salesLineToPricedCreditNoteLine({ returnLine, sourceLine: orderLine, sourceLabel: returnDocument.document_number, priceSource: "order" });
    if (deliveryLine) return salesLineToPricedCreditNoteLine({ returnLine, sourceLine: deliveryLine, sourceLabel: returnDocument.document_number, priceSource: "delivery" });

    const product = returnLine.product_id ? productById.get(returnLine.product_id as string) : null;
    if (product) {
      const taxRate = objectValue(product.tax_rate);
      return salesLineToPricedCreditNoteLine({
        returnLine,
        sourceLine: {
          ...returnLine,
          unit_price_ht: Number(product.sale_price_ht ?? 0),
          tax_rate_id: product.tax_rate_id,
          tax_rate: Number(taxRate?.rate ?? 0),
        },
        sourceLabel: returnDocument.document_number,
        priceSource: "product",
      });
    }

    return salesLineToPricedCreditNoteLine({ returnLine, sourceLine: { ...returnLine, unit_price_ht: 0, tax_rate: 0, tax_rate_id: null }, sourceLabel: returnDocument.document_number, priceSource: "missing" });
  });

  const customer = objectValue(returnDocument.customer);
  return {
    returnDocument: {
      id: returnDocument.id as string,
      document_number: returnDocument.document_number as string,
      customer_id: returnDocument.customer_id as string,
      status: returnDocument.status as string,
      return_reason: returnDocument.return_reason as string | null,
      related_delivery_id: returnDocument.related_delivery_id as string | null,
      related_order_id: returnDocument.related_order_id as string | null,
      stock_updated_at: returnDocument.stock_updated_at as string | null,
    },
    customer: customer ? { id: customer.id as string, name: customer.name as string | null } : null,
    relatedDelivery: returnDocument.related_delivery_id ? { id: returnDocument.related_delivery_id as string, document_number: documentById.get(returnDocument.related_delivery_id as string) ?? "" } : null,
    relatedOrder: returnDocument.related_order_id ? { id: returnDocument.related_order_id as string, document_number: documentById.get(returnDocument.related_order_id as string) ?? "" } : null,
    relatedInvoice,
    existingCreditNote,
    lines: preparedLines,
  };
}

export async function getCreditNoteFormOptions(invoiceId?: string, returnId?: string) {
  const [customers, products, units, taxRates] = await Promise.all([
    listInvoiceCustomers(),
    listInvoiceProducts(),
    listInvoiceUnits(),
    listInvoiceTaxRates(),
  ]);
  const source = invoiceId ? await getCustomerInvoiceDetail(invoiceId) : null;
  const returnPreparation = returnId ? await getCreditNoteReturnPreparation(returnId) : null;
  const sourceLines: InvoiceLineFormValue[] = (source?.lines ?? []).map((line) => calculateInvoiceLine({
    id: line.id,
    mode: line.product_id ? "product" : "free",
    product_id: line.product_id ?? "",
    product_name: line.product_name ?? "",
    description: line.description,
    quantity: line.quantity,
    unit_id: line.unit_id ?? "",
    unit_name: line.unit_name ?? "",
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id ?? "",
    tax_rate: line.tax_rate,
    subtotal_ht: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_ttc: 0,
    source_line_id: line.id,
  }));
  return {
    customers,
    products,
    units,
    taxRates,
    sourceInvoice: source?.invoice ?? null,
    sourceReturn: returnPreparation?.returnDocument ?? null,
    returnPreparation,
    sourceLines: returnPreparation ? returnPreparation.lines : sourceLines,
  };
}

export async function listAvailableCreditNotes(customerId: string) {
  const rows = await listCustomerCreditNotes();
  return rows.filter((row) => row.customer_id === customerId && row.available_amount > 0 && ["validated", "partially_applied"].includes(row.status));
}

export async function listOpenInvoicesForCreditApplication(customerId: string) {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, invoice_date, due_date, total_ttc, paid_amount, credit_amount, remaining_amount, payment_status, status")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .gt("remaining_amount", 0)
    .not("status", "in", "(cancelled,draft)")
    .is("archived_at", null)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    invoice_number: row.invoice_number as string,
    invoice_date: row.invoice_date as string,
    due_date: row.due_date as string | null,
    total_ttc: Number(row.total_ttc ?? 0),
    paid_amount: Number(row.paid_amount ?? 0),
    credit_amount: Number(row.credit_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    payment_status: row.payment_status as string,
    status: row.status as string,
  }));
}

export async function getCreditNoteCounters(): Promise<CreditNoteCounters> {
  const rows = await listCustomerCreditNotes();
  return {
    draft: rows.filter((row) => row.status === "draft").length,
    validated: rows.filter((row) => row.status === "validated").length,
    availableTotal: rows.reduce((sum, row) => sum + row.available_amount, 0),
    availableCount: rows.filter((row) => row.available_amount > 0).length,
  };
}

export { calculateInvoiceLine, calculateInvoiceTotals };
