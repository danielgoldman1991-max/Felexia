import { requireActiveWorkspace } from "@/lib/auth";
import { calculateInvoiceLine, calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { getCustomerInvoiceDetail, listInvoiceCustomers, listInvoiceProducts, listInvoiceTaxRates, listInvoiceUnits } from "@/lib/invoices";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceLineFormValue } from "@/lib/invoice-types";
import type {
  CreditNoteApplicationRecord,
  CreditNoteCounters,
  CustomerCreditNoteDetail,
  CustomerCreditNoteLineRecord,
  CustomerCreditNoteRecord,
} from "@/lib/credit-note-types";

const CREDIT_NOTE_SELECT = `
  id, organization_id, credit_note_number, customer_id, source_invoice_id, source_type,
  credit_note_date, status, subtotal_ht, discount_total, tax_total, total_ttc,
  applied_amount, available_amount, currency, reason, internal_notes, notes,
  validated_at, cancelled_at, created_at, archived_at,
  customer:customer_id(name),
  source_invoice:source_invoice_id(invoice_number)
`;

const CREDIT_NOTE_LINE_SELECT = `
  id, credit_note_id, source_invoice_line_id, line_order, product_id, product_name,
  description, quantity, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id,
  tax_rate, subtotal_ht, discount_amount, tax_amount, total_ttc
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
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    credit_note_number: row.credit_note_number as string,
    customer_id: row.customer_id as string,
    customer_name: customer?.name as string | null,
    source_invoice_id: row.source_invoice_id as string | null,
    source_invoice_number: invoice?.invoice_number as string | null,
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

export async function getCreditNoteFormOptions(invoiceId?: string) {
  const [customers, products, units, taxRates] = await Promise.all([
    listInvoiceCustomers(),
    listInvoiceProducts(),
    listInvoiceUnits(),
    listInvoiceTaxRates(),
  ]);
  const source = invoiceId ? await getCustomerInvoiceDetail(invoiceId) : null;
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
  return { customers, products, units, taxRates, sourceInvoice: source?.invoice ?? null, sourceLines };
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
