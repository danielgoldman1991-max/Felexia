import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateInvoiceLine } from "@/lib/invoice-calculations";
import type {
  BillableDeliveryOption,
  BillableOrderOption,
  CustomerInvoiceAccountingStatus,
  CustomerInvoiceLineRecord,
  CustomerInvoiceRecord,
  InvoiceCounters,
  InvoiceCustomerOption,
  InvoiceLineFormValue,
  InvoiceListFilters,
  InvoiceProductOption,
  OrderBillingGuard,
  OrderBillingGuardDeliveryInvoice,
  OrderBillingGuardInvoice,
} from "@/lib/invoice-types";
import type { TaxRateForSalesSelect, UnitForSalesSelect } from "@/lib/sales-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";
import { getSalesDocumentFlow } from "@/lib/sales";

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

function invoiceAccountingStatus(invoice: CustomerInvoiceRecord, entry?: { id: string; entry_number: string } | null): CustomerInvoiceAccountingStatus {
  if (entry) return "posted";
  if (invoice.status === "draft") return "pending_validation";
  if (invoice.status === "cancelled") return "not_applicable";
  return "not_posted";
}

async function enrichInvoicesAccountingStatus(organizationId: string, invoices: CustomerInvoiceRecord[]) {
  if (invoices.length === 0) return invoices;
  const ids = invoices.map((invoice) => invoice.id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_entries")
    .select("id, entry_number, source_document_id")
    .eq("organization_id", organizationId)
    .eq("source_document_type", "customer_invoice")
    .in("source_document_id", ids)
    .neq("status", "cancelled");

  if (error) {
    return invoices.map((invoice) => ({
      ...invoice,
      accounting_entry_id: null,
      accounting_entry_number: null,
      accounting_status: invoiceAccountingStatus(invoice),
    }));
  }

  const byInvoiceId = new Map(
    (data ?? []).map((entry) => [
      entry.source_document_id as string,
      { id: entry.id as string, entry_number: entry.entry_number as string },
    ]),
  );

  return invoices.map((invoice) => {
    const entry = byInvoiceId.get(invoice.id) ?? null;
    return {
      ...invoice,
      accounting_entry_id: entry?.id ?? null,
      accounting_entry_number: entry?.entry_number ?? null,
      accounting_status: invoiceAccountingStatus(invoice, entry),
    };
  });
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
  const { getGlobalTaxRates } = await import("@/lib/products");
  const taxRates = await getGlobalTaxRates();
  return taxRates.map((row) => ({
    id: row.id,
    name: row.name,
    rate: Number(row.rate ?? 0),
    is_default: Boolean(row.is_default),
    status: row.status ?? null,
  }));
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
  const rows = await enrichInvoicesAccountingStatus(organizationId, (data ?? []).map(mapInvoice));
  return {
    rows,
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

function invoiceStep(invoice: CustomerInvoiceRecord, isCurrent = true): DocumentFlowStep {
  return {
    label: "Facture",
    number: invoice.invoice_number,
    href: `/facturation/factures/${invoice.id}`,
    status: invoice.status,
    isCurrent,
    type: "customer_invoice",
  };
}

function groupedDeliveryStep(deliveries: Array<{ id: string; document_number: string }>): DocumentFlowStep {
  const firstNumbers = deliveries.slice(0, 2).map((delivery) => delivery.document_number).join(" / ");
  const suffix = deliveries.length > 2 ? ` +${deliveries.length - 2}` : "";
  return {
    label: `${deliveries.length} BL factures`,
    number: `${firstNumbers}${suffix}`,
    href: deliveries.length === 1 ? `/vente/livraisons/${deliveries[0].id}` : undefined,
    type: "delivery_note",
  };
}

export async function getCustomerInvoiceDocumentFlow(invoiceId: string): Promise<DocumentFlowStep[]> {
  const { invoice, lines } = await getCustomerInvoiceDetail(invoiceId);
  if (!invoice) return [];

  const deliveryIds = Array.from(
    new Set(
      [
        invoice.source_delivery_id,
        invoice.source_type === "delivery_note" ? invoice.source_document_id : null,
        ...lines.map((line) => line.source_document_id),
      ].filter(Boolean),
    ),
  ) as string[];

  if (deliveryIds.length === 1) {
    const sourceFlow = await getSalesDocumentFlow(deliveryIds[0]);
    return [...sourceFlow.map((step) => ({ ...step, isCurrent: false })), invoiceStep(invoice)];
  }

  if (deliveryIds.length > 1) {
    const organizationId = await activeOrganizationId();
    const supabase = await createClient();
    const { data } = await supabase
      .from("sales_documents")
      .select("id, document_number, related_order_id")
      .eq("organization_id", organizationId)
      .in("id", deliveryIds)
      .is("archived_at", null);

    const deliveries = (data ?? []) as Array<{ id: string; document_number: string; related_order_id: string | null }>;
    const orderIds = Array.from(new Set(deliveries.map((delivery) => delivery.related_order_id).filter(Boolean))) as string[];
    const orderFlow = orderIds.length === 1 ? await getSalesDocumentFlow(orderIds[0]) : [];
    return [
      ...orderFlow.map((step) => ({ ...step, isCurrent: false })).filter((step) => step.type !== "delivery_note"),
      groupedDeliveryStep(deliveries),
      invoiceStep(invoice),
    ];
  }

  if (invoice.source_order_id || (invoice.source_type === "order" && invoice.source_document_id)) {
    const orderId = invoice.source_order_id ?? invoice.source_document_id;
    const sourceFlow = orderId ? await getSalesDocumentFlow(orderId) : [];
    return [...sourceFlow.map((step) => ({ ...step, isCurrent: false })), invoiceStep(invoice)];
  }

  return [invoiceStep(invoice)];
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
  await activeOrganizationId();
  return [];
}

export async function listBillableDeliveryNotes(): Promise<BillableDeliveryOption[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_documents")
    .select("id, document_number, document_date, status, related_order_id, customer:customer_id(name)")
    .eq("organization_id", organizationId)
    .eq("document_type", "delivery_note")
    .eq("status", "validated")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = rows.map((row) => row.id as string);
  const orderIds = Array.from(new Set(rows.map((row) => row.related_order_id).filter(Boolean))) as string[];
  const { data: orders } = orderIds.length
    ? await supabase.from("sales_documents").select("id, document_number").eq("organization_id", organizationId).in("id", orderIds)
    : { data: [] };
  const orderById = new Map((orders ?? []).map((row) => [row.id as string, row.document_number as string]));
  const stats = await deliveryLineStats(organizationId, ids);
  const guards = await Promise.all(
    orderIds.map((orderId) => getOrderBillingGuard(organizationId, orderId)),
  );
  const guardByOrderId = new Map(guards.map((guard) => [guard.orderId, guard]));

  return rows.filter((row) => {
    const orderId = row.related_order_id as string | null;
    const stat = stats.get(row.id as string) ?? { lines_count: 0, total_quantity: 0 };
    return stat.lines_count > 0 && stat.total_quantity > 0 && (!orderId || !guardByOrderId.get(orderId)?.isBlocked);
  }).map((row) => {
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

function mapGuardInvoice(row: Record<string, unknown>): OrderBillingGuardInvoice {
  return {
    id: row.id as string,
    invoice_number: row.invoice_number as string,
    status: row.status as string,
    total_ttc: Number(row.total_ttc ?? 0),
  };
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function getOrderDeliveryRows(organizationId: string, orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_documents")
    .select("id, document_number")
    .eq("organization_id", organizationId)
    .eq("document_type", "delivery_note")
    .or(`related_order_id.eq.${orderId},source_document_id.eq.${orderId}`)
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; document_number: string }>;
}

async function getOrderLineIds(organizationId: string, orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_document_lines")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("document_id", orderId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

export async function getOrderBillingGuard(
  organizationId: string,
  orderId: string,
  options: { excludeInvoiceId?: string | null } = {},
): Promise<OrderBillingGuard> {
  const supabase = await createClient();
  const excludeInvoiceId = options.excludeInvoiceId ?? null;
  const [orderLineIds, deliveryRows] = await Promise.all([
    getOrderLineIds(organizationId, orderId),
    getOrderDeliveryRows(organizationId, orderId),
  ]);
  const deliveryIds = deliveryRows.map((delivery) => delivery.id);
  const deliveryNumberById = new Map(deliveryRows.map((delivery) => [delivery.id, delivery.document_number]));

  const directInvoiceIds = new Set<string>();
  const directInvoices: OrderBillingGuardInvoice[] = [];

  const { data: directByHeader, error: directHeaderError } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, status, total_ttc")
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .is("archived_at", null)
    .or(`source_order_id.eq.${orderId},source_document_id.eq.${orderId}`);
  if (directHeaderError) throw new Error(directHeaderError.message);

  for (const row of (directByHeader ?? []) as Record<string, unknown>[]) {
    const invoice = mapGuardInvoice(row);
    if (invoice.id !== excludeInvoiceId && !directInvoiceIds.has(invoice.id)) {
      directInvoiceIds.add(invoice.id);
      directInvoices.push(invoice);
    }
  }

  const { data: directLineRows, error: directLineError } = orderLineIds.length > 0
    ? await supabase
        .from("customer_invoice_lines")
        .select("invoice_id")
        .eq("organization_id", organizationId)
        .or(`source_document_id.eq.${orderId},source_line_id.in.(${orderLineIds.join(",")})`)
    : await supabase
        .from("customer_invoice_lines")
        .select("invoice_id")
        .eq("organization_id", organizationId)
        .eq("source_document_id", orderId);
  if (directLineError) throw new Error(directLineError.message);

  const lineInvoiceIds = Array.from(new Set((directLineRows ?? []).map((line) => line.invoice_id).filter(Boolean))) as string[];
  const missingDirectInvoiceIds = lineInvoiceIds.filter((id) => id !== excludeInvoiceId && !directInvoiceIds.has(id));
  if (missingDirectInvoiceIds.length > 0) {
    const { data: lineInvoices, error } = await supabase
      .from("customer_invoices")
      .select("id, invoice_number, status, total_ttc")
      .eq("organization_id", organizationId)
      .in("id", missingDirectInvoiceIds)
      .neq("status", "cancelled")
      .is("archived_at", null);
    if (error) throw new Error(error.message);
    for (const row of (lineInvoices ?? []) as Record<string, unknown>[]) {
      const invoice = mapGuardInvoice(row);
      if (!directInvoiceIds.has(invoice.id)) {
        directInvoiceIds.add(invoice.id);
        directInvoices.push(invoice);
      }
    }
  }

  const deliveryInvoices: OrderBillingGuardDeliveryInvoice[] = [];
  const deliveryInvoiceIds = new Set<string>();

  if (deliveryIds.length > 0) {
    const [{ data: bySourceDelivery, error: sourceDeliveryError }, { data: bySourceDocument, error: sourceDocumentError }, { data: lineRows, error: lineError }] = await Promise.all([
      supabase
        .from("customer_invoices")
        .select("id, invoice_number, status, total_ttc, source_delivery_id, source_document_id")
        .eq("organization_id", organizationId)
        .in("source_delivery_id", deliveryIds)
        .neq("status", "cancelled")
        .is("archived_at", null),
      supabase
        .from("customer_invoices")
        .select("id, invoice_number, status, total_ttc, source_delivery_id, source_document_id")
        .eq("organization_id", organizationId)
        .in("source_document_id", deliveryIds)
        .neq("status", "cancelled")
        .is("archived_at", null),
      supabase
        .from("customer_invoice_lines")
        .select("invoice_id, source_document_id")
        .eq("organization_id", organizationId)
        .in("source_document_id", deliveryIds),
    ]);
    if (sourceDeliveryError) throw new Error(sourceDeliveryError.message);
    if (sourceDocumentError) throw new Error(sourceDocumentError.message);
    if (lineError) throw new Error(lineError.message);

    for (const row of [...(bySourceDelivery ?? []), ...(bySourceDocument ?? [])] as Record<string, unknown>[]) {
      const invoice = mapGuardInvoice(row);
      if (invoice.id === excludeInvoiceId || deliveryInvoiceIds.has(invoice.id)) continue;
      const deliveryId = (row.source_delivery_id as string | null) ?? (row.source_document_id as string | null);
      deliveryInvoiceIds.add(invoice.id);
      deliveryInvoices.push({
        ...invoice,
        delivery_id: deliveryId,
        delivery_number: deliveryId ? deliveryNumberById.get(deliveryId) ?? null : null,
      });
    }

    const invoiceIdToDeliveryId = new Map(
      ((lineRows ?? []) as Record<string, unknown>[])
        .filter((line) => line.invoice_id && line.source_document_id)
        .map((line) => [line.invoice_id as string, line.source_document_id as string]),
    );
    const missingInvoiceIds = [...invoiceIdToDeliveryId.keys()].filter((id) => id !== excludeInvoiceId && !deliveryInvoiceIds.has(id));

    if (missingInvoiceIds.length > 0) {
      const { data: invoices, error } = await supabase
        .from("customer_invoices")
        .select("id, invoice_number, status, total_ttc")
        .eq("organization_id", organizationId)
        .in("id", missingInvoiceIds)
        .neq("status", "cancelled")
        .is("archived_at", null);
      if (error) throw new Error(error.message);

      for (const row of (invoices ?? []) as Record<string, unknown>[]) {
        const invoice = mapGuardInvoice(row);
        const deliveryId = invoiceIdToDeliveryId.get(invoice.id) ?? null;
        deliveryInvoiceIds.add(invoice.id);
        deliveryInvoices.push({
          ...invoice,
          delivery_id: deliveryId,
          delivery_number: deliveryId ? deliveryNumberById.get(deliveryId) ?? null : null,
        });
      }
    }
  }

  const uniqueDirectInvoices = uniqueById(directInvoices);
  const uniqueDeliveryInvoices = uniqueById(deliveryInvoices);
  const directInvoice = uniqueDirectInvoices[0] ?? null;
  const hasDirectInvoice = Boolean(directInvoice);
  const hasDeliveryInvoice = uniqueDeliveryInvoices.length > 0;
  const isBlocked = hasDirectInvoice || hasDeliveryInvoice;
  const reason = hasDirectInvoice && hasDeliveryInvoice
    ? "Attention : cette commande possède plusieurs factures liées. Vérification requise."
    : hasDirectInvoice
      ? `Cette commande possède déjà une facture directe ${directInvoice?.invoice_number}.`
      : hasDeliveryInvoice
        ? `Cette commande a déjà été facturée via bon de livraison par ${uniqueDeliveryInvoices[0].invoice_number}.`
        : null;

  return {
    orderId,
    isBlocked,
    reason,
    directInvoice,
    deliveryInvoices: uniqueDeliveryInvoices,
    billableMode: isBlocked ? "none" : "delivery",
  };
}

export async function validateInvoiceSourceBillingLock(
  organizationId: string,
  sourceOrderId: string | null,
  deliveryNoteIds: string[],
  excludeInvoiceId?: string | null,
) {
  const supabase = await createClient();
  const uniqueDeliveryNoteIds = Array.from(new Set(deliveryNoteIds.filter(Boolean)));
  const orderIds = new Set<string>();
  if (sourceOrderId) orderIds.add(sourceOrderId);

  if (uniqueDeliveryNoteIds.length > 0) {
    const { data, error } = await supabase
      .from("sales_documents")
    .select("id, document_number, related_order_id, status")
      .eq("organization_id", organizationId)
      .in("id", uniqueDeliveryNoteIds)
      .eq("document_type", "delivery_note")
      .is("archived_at", null);
    if (error) return { error: error.message };
    if ((data ?? []).length !== uniqueDeliveryNoteIds.length) {
      return { error: "La facture client doit être créée uniquement depuis des bons de livraison validés." };
    }
    for (const delivery of data ?? []) {
      if (delivery.status !== "validated") {
        return { error: "Seuls les bons de livraison validés peuvent être facturés." };
      }
      const orderId = delivery.related_order_id as string | null;
      if (orderId) orderIds.add(orderId);
    }
  }

  for (const orderId of orderIds) {
    const guard = await getOrderBillingGuard(organizationId, orderId, { excludeInvoiceId });
    if (!guard.isBlocked) continue;

    if (uniqueDeliveryNoteIds.length > 0 && guard.directInvoice) {
      return {
        error: `Cette commande a déjà été facturée directement par la facture ${guard.directInvoice.invoice_number}. Vous ne pouvez pas refacturer son bon de livraison.`,
      };
    }
    if (sourceOrderId && guard.deliveryInvoices.length > 0) {
      return {
        error: `Cette commande a déjà été facturée via un bon de livraison par la facture ${guard.deliveryInvoices[0].invoice_number}. Vous ne pouvez pas créer une facture directe depuis cette commande.`,
      };
    }
    if (guard.directInvoice) {
      return { error: `Cette commande possède déjà une facture ${guard.directInvoice.invoice_number}.` };
    }
    if (guard.deliveryInvoices.length > 0) {
      return { error: `Cette commande possède déjà une facture ${guard.deliveryInvoices[0].invoice_number}.` };
    }
  }

  return {};
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
    .eq("status", "validated")
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
  const guards = await Promise.all(
    orderIds.map((orderId) => getOrderBillingGuard(organizationId, orderId)),
  );
  const guardByOrderId = new Map(guards.map((guard) => [guard.orderId, guard]));

  return rows.filter((row) => {
    const orderId = row.related_order_id as string | null;
    const stat = stats.get(row.id as string) ?? { lines_count: 0, total_quantity: 0 };
    return stat.lines_count > 0 && stat.total_quantity > 0 && (!orderId || !guardByOrderId.get(orderId)?.isBlocked);
  }).map((row) => {
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
    .eq("status", "validated")
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

  const orderIds = Array.from(new Set(foundDocuments.map((document) => document.related_order_id).filter(Boolean))) as string[];
  for (const orderId of orderIds) {
    const guard = await getOrderBillingGuard(organizationId, orderId);
    if (guard.directInvoice) {
      throw new Error(`Cette commande a déjà été facturée directement par la facture ${guard.directInvoice.invoice_number}. Vous ne pouvez pas refacturer son bon de livraison.`);
    }
    if (guard.deliveryInvoices.length > 0) {
      throw new Error(`Cette commande possède déjà une facture ${guard.deliveryInvoices[0].invoice_number}.`);
    }
  }

  const { data: lines, error: lineError } = await supabase
    .from("sales_document_lines")
    .select(SALES_LINE_FOR_INVOICE_SELECT)
    .eq("organization_id", organizationId)
    .in("document_id", uniqueIds)
    .order("line_order");
  if (lineError) throw new Error(lineError.message);
  const lineRows = (lines ?? []) as Record<string, unknown>[];
  const totalQuantity = lineRows.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
  if (lineRows.length === 0 || totalQuantity <= 0) {
    throw new Error("Un bon de livraison doit contenir au moins une quantité livrée pour être facturé.");
  }

  const documentById = new Map(foundDocuments.map((document) => [document.id as string, document]));
  const preparedLines = await Promise.all(
    lineRows.map(async (line) => {
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
  void orderId;
  throw new Error("Facturation directe depuis commande désactivée. Créez d’abord un bon de livraison validé, puis facturez le BL.");
}

export async function getDeliveryInvoicePreparation(deliveryId: string) {
  const preparation = await documentToInvoicePreparation(deliveryId, "delivery_note");
  const orderId = preparation?.document.related_order_id;
  if (orderId) {
    const organizationId = await activeOrganizationId();
    const guard = await getOrderBillingGuard(organizationId, orderId);
    if (guard.directInvoice) {
      throw new Error(`Cette commande a déjà été facturée directement par la facture ${guard.directInvoice.invoice_number}. Vous ne pouvez pas refacturer son bon de livraison.`);
    }
    if (guard.deliveryInvoices.length > 0) {
      throw new Error(`Cette commande possède déjà une facture ${guard.deliveryInvoices[0].invoice_number}.`);
    }
  }
  return preparation;
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
