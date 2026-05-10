import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateInvoiceLine } from "@/lib/invoice-calculations";
import type {
  BillableDeliveryOption,
  BillableOrderOption,
  CustomerInvoiceLineRecord,
  CustomerInvoiceRecord,
  InvoiceCounters,
  InvoiceCustomerOption,
  InvoiceLineFormValue,
  InvoiceListFilters,
  InvoiceProductOption,
} from "@/lib/invoice-types";
import type { TaxRateForSalesSelect, UnitForSalesSelect } from "@/lib/sales-types";

const INVOICE_SELECT = `
  id, organization_id, invoice_number, customer_id, source_type, source_document_id,
  source_order_id, source_delivery_id, invoice_date, due_date, status, payment_status,
  payment_terms_days, paid_amount, credit_amount, remaining_amount, subtotal_ht, discount_total,
  tax_total, total_ttc, currency, payment_terms, payment_method,
  custom_payment_terms, custom_payment_method,
  notes, internal_notes, validated_at, sent_at,
  cancelled_at, created_by, created_at, updated_at, archived_at,
  customer:customer_id (name, address, city, phone, email, ice)
`;

const INVOICE_LINE_SELECT = `
  id, organization_id, invoice_id, source_line_id, source_document_id, line_order,
  product_id, product_name, description, quantity, unit_id, unit_name, unit_price_ht,
  discount_rate, tax_rate_id, tax_rate, subtotal_ht, discount_amount, tax_amount,
  total_ttc, created_at, updated_at
`;

const PRODUCT_SELECT = `
  id, type, sku, name, description, unit_id, sale_price_ht, tax_rate_id,
  unit:unit_id (name, symbol),
  tax_rate:tax_rate_id (rate)
`;

const SALES_LINE_FOR_INVOICE_SELECT = `
  id, organization_id, document_id, source_line_id, line_order, product_id,
  product_name, description, quantity, unit_id, unit_name, unit_price_ht,
  discount_rate, tax_rate_id, tax_rate, subtotal_ht, tax_amount, total_ttc,
  created_at, updated_at
`;

function objectValue(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function mapInvoice(raw: unknown): CustomerInvoiceRecord {
  const row = raw as Record<string, unknown>;
  const customer = objectValue(row.customer);

  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    invoice_number: row.invoice_number as string,
    customer_id: row.customer_id as string,
    source_type: row.source_type as CustomerInvoiceRecord["source_type"],
    source_document_id: row.source_document_id as string | null,
    source_order_id: row.source_order_id as string | null,
    source_delivery_id: row.source_delivery_id as string | null,
    invoice_date: row.invoice_date as string,
    due_date: row.due_date as string | null,
    status: row.status as CustomerInvoiceRecord["status"],
    payment_status: row.payment_status as CustomerInvoiceRecord["payment_status"],
    payment_terms_days: Number(row.payment_terms_days ?? 0),
    paid_amount: Number(row.paid_amount ?? 0),
    credit_amount: Number(row.credit_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    discount_total: Number(row.discount_total ?? 0),
    tax_total: Number(row.tax_total ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    currency: row.currency as string,
    payment_terms: row.payment_terms as string | null,
    payment_method: row.payment_method as string | null,
    custom_payment_terms: row.custom_payment_terms as string | null,
    custom_payment_method: row.custom_payment_method as string | null,
    notes: row.notes as string | null,
    internal_notes: row.internal_notes as string | null,
    validated_at: row.validated_at as string | null,
    sent_at: row.sent_at as string | null,
    cancelled_at: row.cancelled_at as string | null,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: row.archived_at as string | null,
    customer_name: customer?.name as string | null,
    customer_address: customer?.address as string | null,
    customer_city: customer?.city as string | null,
    customer_phone: customer?.phone as string | null,
    customer_email: customer?.email as string | null,
    customer_ice: customer?.ice as string | null,
  };
}

function mapLine(raw: unknown): CustomerInvoiceLineRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    invoice_id: row.invoice_id as string,
    source_line_id: row.source_line_id as string | null,
    source_document_id: row.source_document_id as string | null,
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
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function activeOrganizationId() {
  const workspace = await requireActiveWorkspace();
  return workspace.organization.id;
}

export async function listInvoiceCustomers(): Promise<InvoiceCustomerOption[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_parties")
    .select("id, name, commercial_name, ice, email, phone, city, types, primary_type, payment_terms, payment_method, payment_terms_days, custom_payment_terms, custom_payment_method")
    .eq("organization_id", organizationId)
    .contains("types", ["customer"])
    .eq("status", "active")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceCustomerOption[];
}

export async function listInvoiceProducts(): Promise<InvoiceProductOption[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const unit = objectValue(record.unit);
    const taxRate = objectValue(record.tax_rate);
    return {
      ...(record as unknown as InvoiceProductOption),
      unit_name: unit?.name as string | null,
      unit_symbol: unit?.symbol as string | null,
      tax_rate_value: taxRate?.rate === undefined ? null : Number(taxRate.rate),
    };
  });
}

export async function listInvoiceUnits(): Promise<UnitForSalesSelect[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, name, symbol")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as UnitForSalesSelect[];
}

export async function listInvoiceTaxRates(): Promise<TaxRateForSalesSelect[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("id, name, rate, is_default")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("archived_at", null)
    .order("rate");

  if (error) throw new Error(error.message);
  return (data ?? []) as TaxRateForSalesSelect[];
}

export async function listCustomerInvoices(filters: InvoiceListFilters = {}) {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("customer_invoices")
    .select(INVOICE_SELECT, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.paymentStatus && filters.paymentStatus !== "all") query = query.eq("payment_status", filters.paymentStatus);
  if (filters.query) {
    const value = filters.query.trim();
    if (value) query = query.or(`invoice_number.ilike.%${value}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map(mapInvoice),
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getCustomerInvoiceDetail(id: string) {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const [invoiceResult, linesResult] = await Promise.all([
    supabase.from("customer_invoices").select(INVOICE_SELECT).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    supabase.from("customer_invoice_lines").select(INVOICE_LINE_SELECT).eq("organization_id", organizationId).eq("invoice_id", id).order("line_order"),
  ]);

  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);

  return {
    invoice: invoiceResult.data ? await enrichInvoiceSources(organizationId, mapInvoice(invoiceResult.data)) : null,
    lines: (linesResult.data ?? []).map(mapLine),
  };
}

async function enrichInvoiceSources(organizationId: string, invoice: CustomerInvoiceRecord) {
  const ids = [invoice.source_document_id, invoice.source_order_id, invoice.source_delivery_id].filter(Boolean) as string[];
  if (ids.length === 0) return invoice;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_documents")
    .select("id, document_number")
    .eq("organization_id", organizationId)
    .in("id", ids);
  const byId = new Map((data ?? []).map((row) => [row.id as string, row.document_number as string]));
  return {
    ...invoice,
    source_document_number: invoice.source_document_id ? byId.get(invoice.source_document_id) ?? null : null,
    source_order_number: invoice.source_order_id ? byId.get(invoice.source_order_id) ?? null : null,
    source_delivery_number: invoice.source_delivery_id ? byId.get(invoice.source_delivery_id) ?? null : null,
  };
}

export async function listBillableOrders(): Promise<BillableOrderOption[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_documents")
    .select("id, document_number, document_date, status, total_ttc, customer:customer_id(name)")
    .eq("organization_id", organizationId)
    .eq("document_type", "order")
    .in("status", ["confirmed", "partially_delivered", "delivered"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const customer = objectValue((row as Record<string, unknown>).customer);
    return {
      id: row.id as string,
      document_number: row.document_number as string,
      customer_name: customer?.name as string | null,
      document_date: row.document_date as string,
      status: row.status as string,
      total_ttc: Number(row.total_ttc ?? 0),
    };
  });
}

export async function listBillableDeliveryNotes(): Promise<BillableDeliveryOption[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_documents")
    .select("id, document_number, document_date, status, related_order_id, customer:customer_id(name)")
    .eq("organization_id", organizationId)
    .eq("document_type", "delivery_note")
    .in("status", ["validated", "delivered"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const orderIds = Array.from(new Set(rows.map((row) => row.related_order_id).filter(Boolean))) as string[];
  const { data: orders } = orderIds.length
    ? await supabase.from("sales_documents").select("id, document_number").eq("organization_id", organizationId).in("id", orderIds)
    : { data: [] };
  const orderById = new Map((orders ?? []).map((row) => [row.id as string, row.document_number as string]));

  return rows.map((row) => {
    const customer = objectValue(row.customer);
    return {
      id: row.id as string,
      document_number: row.document_number as string,
      customer_name: customer?.name as string | null,
      document_date: row.document_date as string,
      status: row.status as string,
      related_order_number: row.related_order_id ? orderById.get(row.related_order_id as string) ?? null : null,
    };
  });
}

async function documentToInvoicePreparation(documentId: string, type: "order" | "delivery_note") {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data: document, error: docError } = await supabase
    .from("sales_documents")
    .select("*, customer:customer_id(name)")
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .eq("document_type", type)
    .maybeSingle();
  if (docError) throw new Error(docError.message);
  if (!document) return null;

  const { data: lines, error: lineError } = await supabase
    .from("sales_document_lines")
    .select(SALES_LINE_FOR_INVOICE_SELECT)
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .order("line_order");
  if (lineError) throw new Error(lineError.message);

  return {
    document: mapSalesSourceDocument(document),
    lines: await Promise.all(((lines ?? []) as Record<string, unknown>[]).map((line) => sourceLineToInvoiceLine(organizationId, line, documentId))),
  };
}

function mapSalesSourceDocument(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    document_number: row.document_number as string,
    customer_id: row.customer_id as string,
    related_order_id: row.related_order_id as string | null,
    related_delivery_id: row.related_delivery_id as string | null,
    document_date: row.document_date as string,
  };
}

async function deliveryInvoiceUsage(organizationId: string, deliveryIds: string[]) {
  if (deliveryIds.length === 0) return new Set<string>();
  const supabase = await createClient();
  const { data: invoiceLines, error: lineError } = await supabase
    .from("customer_invoice_lines")
    .select("invoice_id, source_document_id")
    .eq("organization_id", organizationId)
    .in("source_document_id", deliveryIds);
  if (lineError) throw new Error(lineError.message);

  const invoiceIds = Array.from(new Set((invoiceLines ?? []).map((line) => line.invoice_id).filter(Boolean))) as string[];
  if (invoiceIds.length === 0) return new Set<string>();

  const { data: invoices, error: invoiceError } = await supabase
    .from("customer_invoices")
    .select("id, status")
    .eq("organization_id", organizationId)
    .in("id", invoiceIds)
    .neq("status", "cancelled")
    .is("archived_at", null);
  if (invoiceError) throw new Error(invoiceError.message);

  const activeInvoiceIds = new Set((invoices ?? []).map((invoice) => invoice.id as string));
  return new Set(
    (invoiceLines ?? [])
      .filter((line) => activeInvoiceIds.has(line.invoice_id as string))
      .map((line) => line.source_document_id as string),
  );
}

async function deliveryLineStats(organizationId: string, deliveryIds: string[]) {
  if (deliveryIds.length === 0) return new Map<string, { lines_count: number; total_quantity: number }>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_document_lines")
    .select("document_id, quantity")
    .eq("organization_id", organizationId)
    .in("document_id", deliveryIds);
  if (error) throw new Error(error.message);

  const stats = new Map<string, { lines_count: number; total_quantity: number }>();
  for (const row of data ?? []) {
    const documentId = row.document_id as string;
    const current = stats.get(documentId) ?? { lines_count: 0, total_quantity: 0 };
    stats.set(documentId, {
      lines_count: current.lines_count + 1,
      total_quantity: current.total_quantity + Number(row.quantity ?? 0),
    });
  }
  return stats;
}

export async function listBillableDeliveryNotesByCustomer(customerId: string): Promise<BillableDeliveryOption[]> {
  if (!customerId) return [];
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_documents")
    .select("id, document_number, document_date, status, customer_id, related_order_id, customer:customer_id(name)")
    .eq("organization_id", organizationId)
    .eq("document_type", "delivery_note")
    .eq("customer_id", customerId)
    .in("status", ["validated", "delivered"])
    .is("archived_at", null)
    .order("document_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = rows.map((row) => row.id as string);
  const orderIds = Array.from(new Set(rows.map((row) => row.related_order_id).filter(Boolean))) as string[];

  const [{ data: orders }, stats, invoicedIds] = await Promise.all([
    orderIds.length
      ? supabase.from("sales_documents").select("id, document_number").eq("organization_id", organizationId).in("id", orderIds)
      : Promise.resolve({ data: [] }),
    deliveryLineStats(organizationId, ids),
    deliveryInvoiceUsage(organizationId, ids),
  ]);
  const orderById = new Map((orders ?? []).map((row) => [row.id as string, row.document_number as string]));

  return rows.map((row) => {
    const customer = objectValue(row.customer);
    const stat = stats.get(row.id as string) ?? { lines_count: 0, total_quantity: 0 };
    return {
      id: row.id as string,
      document_number: row.document_number as string,
      customer_id: row.customer_id as string,
      customer_name: customer?.name as string | null,
      document_date: row.document_date as string,
      status: row.status as string,
      related_order_number: row.related_order_id ? orderById.get(row.related_order_id as string) ?? null : null,
      lines_count: stat.lines_count,
      total_quantity: stat.total_quantity,
      already_invoiced: invoicedIds.has(row.id as string),
    };
  });
}

async function sourceLineToInvoiceLine(organizationId: string, line: Record<string, unknown>, documentId: string): Promise<InvoiceLineFormValue> {
  let source = line;
  if (line.source_line_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("sales_document_lines")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", line.source_line_id as string)
      .maybeSingle();
    if (data) source = { ...data, quantity: line.quantity };
  }

  return calculateInvoiceLine({
    id: `source-${line.id}`,
    mode: source.product_id ? "product" : "free",
    product_id: (source.product_id as string) ?? "",
    product_name: (source.product_name as string) ?? "",
    description: source.description as string,
    quantity: Number(line.quantity ?? source.quantity ?? 1),
    unit_id: (source.unit_id as string) ?? "",
    unit_name: (source.unit_name as string) ?? "",
    unit_price_ht: Number(source.unit_price_ht ?? 0),
    discount_rate: Number(source.discount_rate ?? 0),
    tax_rate_id: (source.tax_rate_id as string) ?? "",
    tax_rate: Number(source.tax_rate ?? 0),
    subtotal_ht: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_ttc: 0,
    source_line_id: line.id as string,
    source_document_id: documentId,
    source_label: null,
  });
}

export async function getDeliveryNotesInvoicePreparation(customerId: string, deliveryNoteIds: string[]) {
  const uniqueIds = Array.from(new Set(deliveryNoteIds.filter(Boolean)));
  if (!customerId || uniqueIds.length === 0) return { lines: [] as InvoiceLineFormValue[], deliveryNotes: [] as BillableDeliveryOption[] };

  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data: documents, error: documentError } = await supabase
    .from("sales_documents")
    .select("id, document_number, document_date, status, customer_id, related_order_id, customer:customer_id(name)")
    .eq("organization_id", organizationId)
    .eq("document_type", "delivery_note")
    .eq("customer_id", customerId)
    .in("status", ["validated", "delivered"])
    .in("id", uniqueIds)
    .is("archived_at", null);
  if (documentError) throw new Error(documentError.message);

  const foundDocuments = (documents ?? []) as Record<string, unknown>[];
  if (foundDocuments.length !== uniqueIds.length) throw new Error("Certains bons de livraison ne sont pas facturables pour ce client.");

  const usedDeliveryIds = await deliveryInvoiceUsage(organizationId, uniqueIds);
  if (usedDeliveryIds.size > 0) {
    const blocked = foundDocuments.find((document) => usedDeliveryIds.has(document.id as string));
    throw new Error(`Le bon de livraison ${blocked?.document_number ?? ""} est deja rattache a une facture.`);
  }

  const { data: lines, error: lineError } = await supabase
    .from("sales_document_lines")
    .select(SALES_LINE_FOR_INVOICE_SELECT)
    .eq("organization_id", organizationId)
    .in("document_id", uniqueIds)
    .order("line_order");
  if (lineError) throw new Error(lineError.message);

  const documentById = new Map(foundDocuments.map((document) => [document.id as string, document]));
  const preparedLines = await Promise.all(
    ((lines ?? []) as Record<string, unknown>[]).map(async (line) => {
      const documentId = line.document_id as string;
      const document = documentById.get(documentId);
      const prepared = await sourceLineToInvoiceLine(organizationId, line, documentId);
      return {
        ...prepared,
        id: `delivery-${documentId}-${line.id}`,
        source_label: document?.document_number as string | null,
      };
    }),
  );

  const stats = await deliveryLineStats(organizationId, uniqueIds);
  const deliveryNotes = foundDocuments.map((document) => {
    const customer = objectValue(document.customer);
    const stat = stats.get(document.id as string) ?? { lines_count: 0, total_quantity: 0 };
    return {
      id: document.id as string,
      document_number: document.document_number as string,
      customer_id: document.customer_id as string,
      customer_name: customer?.name as string | null,
      document_date: document.document_date as string,
      status: document.status as string,
      related_order_number: null,
      lines_count: stat.lines_count,
      total_quantity: stat.total_quantity,
      already_invoiced: false,
    };
  });

  return { lines: preparedLines, deliveryNotes };
}

export async function getOrderInvoicePreparation(orderId: string) {
  return documentToInvoicePreparation(orderId, "order");
}

export async function getDeliveryInvoicePreparation(deliveryId: string) {
  return documentToInvoicePreparation(deliveryId, "delivery_note");
}

export async function getInvoiceCounters(): Promise<InvoiceCounters> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_invoices")
    .select("status, total_ttc, paid_amount, remaining_amount, due_date")
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const today = new Date().toISOString().split("T")[0];
  return {
    draft: rows.filter((row) => row.status === "draft").length,
    validated: rows.filter((row) => row.status === "validated").length,
    sent: rows.filter((row) => row.status === "sent").length,
    overdue: rows.filter((row) => row.due_date && row.due_date < today && !["paid", "cancelled"].includes(row.status as string)).length,
    invoicedTotal: rows.reduce((sum, row) => sum + Number(row.total_ttc ?? 0), 0),
    paidTotal: rows.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0),
    remainingTotal: rows.reduce((sum, row) => sum + Number(row.remaining_amount ?? 0), 0),
  };
}
