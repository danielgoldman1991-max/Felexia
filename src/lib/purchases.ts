import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type {
  PurchaseDocumentRecord,
  PurchaseDocumentLineRecord,
  PurchaseDocumentType,
  PurchaseCounters,
  PurchaseProductOption,
  SupplierInvoiceRecord,
  SupplierInvoiceLineRecord,
  SupplierPaymentRecord,
  SupplierPaymentAllocationRecord,
  ReceivableSupplierOrder,
  ReceivableSupplierOrderLine,
  BillableSupplierReceipt,
} from "@/lib/purchase-types";
import type { DocumentFlowStep } from "@/lib/document-flow-types";

const PURCHASE_DOCUMENT_SELECT = `
  id, organization_id, document_type, document_number, supplier_id,
  source_document_id, related_order_id,
  document_date, expected_receipt_date, receipt_date,
  status, subtotal_ht, discount_total, tax_total, total_ttc, currency,
  notes, internal_notes, validated_at, stock_updated_at,
  warehouse_id,
  created_by, created_at, updated_at, archived_at,
  supplier:supplier_id (name, ice, phone, email),
  warehouse:warehouse_id (name)
`;

const PURCHASE_DOCUMENT_LINE_SELECT = `
  id, organization_id, document_id, source_line_id, line_order,
  product_id, product_name, description, quantity,
  unit_id, unit_name, unit_price_ht, discount_rate,
  tax_rate_id, tax_rate, subtotal_ht, discount_amount, tax_amount, total_ttc,
  ordered_quantity, received_quantity, remaining_quantity, stock_move_id,
  created_at, updated_at
`;

const SUPPLIER_INVOICE_SELECT = `
  id, organization_id, invoice_number, supplier_invoice_number, supplier_id,
  source_type, source_receipt_id, invoice_date, due_date,
  status, payment_status, subtotal_ht, discount_total, tax_total, total_ttc,
  paid_amount, remaining_amount, currency, notes, internal_notes,
  validated_at, created_by, created_at, updated_at, archived_at,
  supplier:supplier_id (name, ice, phone, email)
`;

const SUPPLIER_INVOICE_LINE_SELECT = `
  id, organization_id, invoice_id, source_line_id, source_document_id,
  line_order, product_id, product_name, description, quantity,
  unit_id, unit_name, unit_price_ht, discount_rate,
  tax_rate_id, tax_rate, subtotal_ht, discount_amount, tax_amount, total_ttc,
  created_at, updated_at
`;

function extractSupplier(raw: Record<string, unknown>): { name: string | null; ice: string | null; phone: string | null; email: string | null } {
  const s = raw.supplier as Record<string, unknown> | undefined;
  if (!s || typeof s !== "object") return { name: null, ice: null, phone: null, email: null };
  return {
    name: (s.name as string) ?? null,
    ice: (s.ice as string) ?? null,
    phone: (s.phone as string) ?? null,
    email: (s.email as string) ?? null,
  };
}

function extractWarehouse(raw: Record<string, unknown>): { name: string | null } {
  const w = raw.warehouse as Record<string, unknown> | undefined;
  if (!w || typeof w !== "object") return { name: null };
  return { name: (w.name as string) ?? null };
}

function mapPurchaseDocument(raw: Record<string, unknown>): PurchaseDocumentRecord {
  const supplier = extractSupplier(raw);
  const warehouse = extractWarehouse(raw);
  return { ...raw, supplier_name: supplier.name, supplier_ice: supplier.ice, supplier_phone: supplier.phone, supplier_email: supplier.email, warehouse_name: warehouse.name } as unknown as PurchaseDocumentRecord;
}

function mapSupplierInvoice(raw: Record<string, unknown>): SupplierInvoiceRecord {
  const supplier = extractSupplier(raw);
  return { ...raw, supplier_name: supplier.name, supplier_ice: supplier.ice, supplier_phone: supplier.phone, supplier_email: supplier.email } as unknown as SupplierInvoiceRecord;
}

export async function getPurchaseCounters(): Promise<PurchaseCounters> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const [draftOrders, confirmedOrders, draftReceipts, unpaidInvoices, payments] = await Promise.all([
    supabase.from("purchase_documents").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("document_type", "supplier_order").eq("status", "draft").is("archived_at", null),
    supabase.from("purchase_documents").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("document_type", "supplier_order").in("status", ["confirmed", "partially_received"]).is("archived_at", null),
    supabase.from("purchase_documents").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("document_type", "supplier_receipt").eq("status", "draft").is("archived_at", null),
    supabase.from("supplier_invoices").select("id, total_ttc, remaining_amount", { count: "exact", head: false }).eq("organization_id", orgId).in("status", ["validated", "partially_paid"]).is("archived_at", null),
    supabase.from("supplier_payments").select("id, available_amount", { count: "exact", head: false }).eq("organization_id", orgId).eq("status", "confirmed").is("archived_at", null),
  ]);

  const totalToPay = (unpaidInvoices.data ?? []).reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);
  const unallocatedAmount = (payments.data ?? []).reduce((sum, p) => sum + Number(p.available_amount), 0);

  return {
    draftOrders: draftOrders.count ?? 0,
    confirmedOrders: confirmedOrders.count ?? 0,
    draftReceipts: draftReceipts.count ?? 0,
    unpaidInvoices: unpaidInvoices.count ?? 0,
    totalToPay,
    unallocatedPayments: unallocatedAmount,
  };
}

export async function listPurchaseSuppliers() {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const { data } = await supabase
    .from("third_parties")
    .select("id, name, ice, phone, email, city, status")
    .eq("organization_id", workspace.organization.id)
    .contains("types", ["supplier"])
    .eq("status", "active")
    .is("archived_at", null)
    .order("name");
  return data ?? [];
}

export async function listPurchaseProducts(): Promise<PurchaseProductOption[]> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const { data } = await supabase
    .from("products")
    .select("id, type, sku, name, description, unit_id, unit:unit_id(name, symbol), purchase_price_ht, tax_rate_id, tax_rate:tax_rate_id(name, rate), track_stock, current_stock, is_purchasable, status")
    .eq("organization_id", workspace.organization.id)
    .eq("status", "active")
    .is("archived_at", null)
    .order("name");
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    type: p.type as string,
    name: p.name as string,
    sku: (p.sku as string) ?? null,
    purchase_price_ht: Number(p.purchase_price_ht) || 0,
    unit_name: ((p.unit as Record<string, unknown>)?.["name"] as string) ?? null,
    unit_symbol: ((p.unit as Record<string, unknown>)?.["symbol"] as string) ?? null,
    tax_rate_value: ((p.tax_rate as Record<string, unknown>)?.["rate"] as number) ?? null,
    tax_rate_id: (p.tax_rate_id as string) ?? null,
    unit_id: (p.unit_id as string) ?? null,
    is_purchasable: Boolean(p.is_purchasable),
  })) as PurchaseProductOption[];
}

export async function listPurchaseDocuments(type: PurchaseDocumentType, filters?: { status?: string; search?: string }) {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  let query = supabase
    .from("purchase_documents")
    .select(PURCHASE_DOCUMENT_SELECT)
    .eq("organization_id", workspace.organization.id)
    .eq("document_type", type)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.search) query = query.or(`document_number.ilike.%${filters.search}%,supplier.name.ilike.%${filters.search}%`);
  const { data } = await query;
  return { rows: (data ?? []).map((r: Record<string, unknown>) => mapPurchaseDocument(r)) };
}

export async function getPurchaseDocumentDetail(id: string): Promise<{ document: PurchaseDocumentRecord | null; lines: PurchaseDocumentLineRecord[] }> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const [docRes, linesRes] = await Promise.all([
    supabase.from("purchase_documents").select(PURCHASE_DOCUMENT_SELECT).eq("id", id).eq("organization_id", orgId).single(),
    supabase.from("purchase_document_lines").select(PURCHASE_DOCUMENT_LINE_SELECT).eq("document_id", id).eq("organization_id", orgId).order("line_order"),
  ]);
  if (docRes.error) return { document: null, lines: [] };
  return { document: mapPurchaseDocument(docRes.data as Record<string, unknown>), lines: (linesRes.data ?? []) as PurchaseDocumentLineRecord[] };
}

type PurchaseFlowRow = {
  id: string;
  document_type: PurchaseDocumentType;
  document_number: string;
  status: string | null;
  source_document_id: string | null;
  related_order_id: string | null;
};

function purchaseStep(row: PurchaseFlowRow, currentId: string): DocumentFlowStep {
  const isOrder = row.document_type === "supplier_order";
  return {
    label: isOrder ? "Commande fournisseur" : "Reception",
    number: row.document_number,
    href: isOrder ? `/achats/commandes/${row.id}` : `/achats/receptions/${row.id}`,
    status: row.status,
    isCurrent: row.id === currentId,
    type: row.document_type,
  };
}

export async function getPurchaseDocumentFlow(documentId: string): Promise<DocumentFlowStep[]> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const rowsById = new Map<string, PurchaseFlowRow>();
  const idsToFetch = new Set<string>([documentId]);

  for (let pass = 0; pass < 3; pass += 1) {
    const missingIds = [...idsToFetch].filter((id) => !rowsById.has(id));
    if (missingIds.length === 0) break;
    const { data, error } = await supabase
      .from("purchase_documents")
      .select("id, document_type, document_number, status, source_document_id, related_order_id")
      .eq("organization_id", orgId)
      .in("id", missingIds)
      .is("archived_at", null);
    if (error) return [];
    for (const row of (data ?? []) as PurchaseFlowRow[]) {
      rowsById.set(row.id, row);
      if (row.source_document_id) idsToFetch.add(row.source_document_id);
      if (row.related_order_id) idsToFetch.add(row.related_order_id);
    }
  }

  const current = rowsById.get(documentId);
  if (!current) return [];
  const order = current.document_type === "supplier_order"
    ? current
    : current.related_order_id
      ? rowsById.get(current.related_order_id)
      : null;
  return [order, current]
    .filter((row): row is PurchaseFlowRow => Boolean(row))
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)
    .map((row) => purchaseStep(row, documentId));
}

/** Compute REAL received quantities for order lines from validated receipts. */
export async function getSupplierOrderLineProgress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  orderId: string,
  excludeReceiptId?: string
): Promise<Map<string, { ordered: number; received: number; remaining: number }>> {
  const { data: orderLines } = await supabase
    .from("purchase_document_lines")
    .select("id, quantity, product_name, unit_name, product_id, line_order")
    .eq("document_id", orderId)
    .eq("organization_id", orgId)
    .order("line_order");
  if (!orderLines) return new Map();
  let query = supabase
    .from("purchase_documents")
    .select("id")
    .eq("related_order_id", orderId)
    .eq("document_type", "supplier_receipt")
    .eq("status", "validated")
    .is("archived_at", null);
  if (excludeReceiptId) query = query.neq("id", excludeReceiptId);
  const { data: receipts } = await query;
  const receiptIds = (receipts ?? []).map((r: { id: string }) => r.id);
  const receivedMap = new Map<string, number>();
  if (receiptIds.length > 0) {
    const { data: receiptLines } = await supabase
      .from("purchase_document_lines")
      .select("source_line_id, quantity")
      .in("document_id", receiptIds)
      .not("source_line_id", "is", null);
    (receiptLines ?? []).forEach((l: { source_line_id: string; quantity: number }) => {
      const sid = l.source_line_id as string;
      const current = receivedMap.get(sid) ?? 0;
      receivedMap.set(sid, current + Number(l.quantity));
    });
  }
  const result = new Map<string, { ordered: number; received: number; remaining: number }>();
  for (const ol of orderLines) {
    const ordered = Number(ol.quantity) || 0;
    const received = receivedMap.get(ol.id) ?? 0;
    const remaining = Math.max(ordered - received, 0);
    result.set(ol.id, { ordered, received, remaining });
  }
  return result;
}

export async function listReceivableSupplierOrders(): Promise<ReceivableSupplierOrder[]> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const { data: docs } = await supabase
    .from("purchase_documents")
    .select(PURCHASE_DOCUMENT_SELECT)
    .eq("organization_id", orgId)
    .eq("document_type", "supplier_order")
    .in("status", ["confirmed", "partially_received"])
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (!docs) return [];
  const orders: ReceivableSupplierOrder[] = [];
  for (const raw of docs) {
    const doc = mapPurchaseDocument(raw as Record<string, unknown>);
    const progress = await getSupplierOrderLineProgress(supabase as never, orgId, doc.id);
    const { data: lines } = await supabase
      .from("purchase_document_lines")
      .select(`id, product_id, product:product_id(type, track_stock), quantity, description, product_name, unit_name, unit_price_ht`)
      .eq("document_id", doc.id)
      .eq("organization_id", orgId)
      .order("line_order");
    const mappedLines: ReceivableSupplierOrderLine[] = (lines ?? []).map((l: Record<string, unknown>) => {
      const prod = l.product as Record<string, unknown> | undefined;
      const productType = (prod?.type as string) ?? null;
      const trackStock = (prod?.track_stock as boolean) ?? false;
      const ordered = Number(l.quantity) || 0;
      const p = progress.get(l.id as string);
      const received = p?.received ?? 0;
      const remaining = p?.remaining ?? 0;
      return {
        ...l,
        unit_price_ht: Number(l.unit_price_ht),
        ordered_quantity: ordered,
        received_quantity: received,
        remaining_quantity: remaining,
        quantity: remaining,
        already_received: received,
        remaining_to_receive: remaining,
        track_stock: trackStock,
        product_type: productType,
        is_stockable: productType === "product" && trackStock,
      } as unknown as ReceivableSupplierOrderLine;
    });
    const allReceived = mappedLines.every((l) => l.remaining_to_receive <= 0);
    if (!allReceived) {
      orders.push({ ...doc, lines: mappedLines });
    }
  }
  return orders;
}

export async function getSupplierReceiptPreparation(orderId: string): Promise<ReceivableSupplierOrder | null> {
  const orders = await listReceivableSupplierOrders();
  return orders.find((o) => o.id === orderId) ?? null;
}

export async function listBillableSupplierReceipts(supplierId?: string): Promise<BillableSupplierReceipt[]> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  let query = supabase
    .from("purchase_documents")
    .select(PURCHASE_DOCUMENT_SELECT)
    .eq("organization_id", orgId)
    .eq("document_type", "supplier_receipt")
    .eq("status", "validated")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data: docs } = await query;
  if (!docs) return [];
  const receipts: BillableSupplierReceipt[] = [];
  for (const raw of docs) {
    const doc = mapPurchaseDocument(raw as Record<string, unknown>);
    const { data: lines } = await supabase
      .from("purchase_document_lines")
      .select(PURCHASE_DOCUMENT_LINE_SELECT)
      .eq("document_id", doc.id)
      .eq("organization_id", orgId)
      .order("line_order");
    const { data: existingInvoices } = await supabase
      .from("supplier_invoices")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("source_receipt_id", doc.id)
      .not("status", "eq", "cancelled")
      .limit(1);
    receipts.push({ ...doc, lines: (lines ?? []) as PurchaseDocumentLineRecord[], already_invoiced: (existingInvoices?.length ?? 0) > 0 });
  }
  return receipts;
}

export async function listSupplierInvoices(filters?: { status?: string; supplierId?: string }) {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  let query = supabase
    .from("supplier_invoices")
    .select(SUPPLIER_INVOICE_SELECT)
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.supplierId) query = query.eq("supplier_id", filters.supplierId);
  const { data } = await query;
  return { rows: (data ?? []).map((r: Record<string, unknown>) => mapSupplierInvoice(r)) };
}

export async function getSupplierInvoiceDetail(id: string): Promise<{ invoice: SupplierInvoiceRecord | null; lines: SupplierInvoiceLineRecord[] }> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const [invRes, linesRes] = await Promise.all([
    supabase.from("supplier_invoices").select(SUPPLIER_INVOICE_SELECT).eq("id", id).eq("organization_id", orgId).single(),
    supabase.from("supplier_invoice_lines").select(SUPPLIER_INVOICE_LINE_SELECT).eq("invoice_id", id).eq("organization_id", orgId).order("line_order"),
  ]);
  if (invRes.error) return { invoice: null, lines: [] };
  return { invoice: mapSupplierInvoice(invRes.data as Record<string, unknown>), lines: (linesRes.data ?? []) as SupplierInvoiceLineRecord[] };
}

function supplierInvoiceStep(invoice: SupplierInvoiceRecord): DocumentFlowStep {
  return {
    label: "Facture fournisseur",
    number: invoice.invoice_number,
    href: `/achats/factures/${invoice.id}`,
    status: invoice.status,
    isCurrent: true,
    type: "supplier_invoice",
  };
}

function groupedReceiptStep(receipts: Array<{ id: string; document_number: string }>): DocumentFlowStep {
  const firstNumbers = receipts.slice(0, 2).map((receipt) => receipt.document_number).join(" / ");
  const suffix = receipts.length > 2 ? ` +${receipts.length - 2}` : "";
  return {
    label: `${receipts.length} receptions`,
    number: `${firstNumbers}${suffix}`,
    href: receipts.length === 1 ? `/achats/receptions/${receipts[0].id}` : undefined,
    type: "supplier_receipt",
  };
}

export async function getSupplierInvoiceDocumentFlow(invoiceId: string): Promise<DocumentFlowStep[]> {
  const { invoice, lines } = await getSupplierInvoiceDetail(invoiceId);
  if (!invoice) return [];

  const receiptIds = Array.from(new Set([invoice.source_receipt_id, ...lines.map((line) => line.source_document_id)].filter(Boolean))) as string[];
  if (receiptIds.length === 1) {
    const sourceFlow = await getPurchaseDocumentFlow(receiptIds[0]);
    return [...sourceFlow.map((step) => ({ ...step, isCurrent: false })), supplierInvoiceStep(invoice)];
  }

  if (receiptIds.length > 1) {
    const supabase = await createClient();
    const workspace = await requireActiveWorkspace();
    const orgId = workspace.organization.id;
    const { data } = await supabase
      .from("purchase_documents")
      .select("id, document_number, related_order_id")
      .eq("organization_id", orgId)
      .in("id", receiptIds)
      .is("archived_at", null);

    const receipts = (data ?? []) as Array<{ id: string; document_number: string; related_order_id: string | null }>;
    const orderIds = Array.from(new Set(receipts.map((receipt) => receipt.related_order_id).filter(Boolean))) as string[];
    const orderFlow = orderIds.length === 1 ? await getPurchaseDocumentFlow(orderIds[0]) : [];
    return [
      ...orderFlow.map((step) => ({ ...step, isCurrent: false })).filter((step) => step.type !== "supplier_receipt"),
      groupedReceiptStep(receipts),
      supplierInvoiceStep(invoice),
    ];
  }

  return [supplierInvoiceStep(invoice)];
}

export async function listSupplierPayments(filters?: { status?: string; supplierId?: string }) {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  let query = supabase
    .from("supplier_payments")
    .select(`*, supplier:supplier_id (name)`)
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.supplierId) query = query.eq("supplier_id", filters.supplierId);
  const { data } = await query;
  return { rows: (data ?? []).map((r: Record<string, unknown>) => ({ ...r, supplier_name: (r.supplier as Record<string, unknown>)?.["name"] ?? null })) as SupplierPaymentRecord[] };
}

export async function getSupplierPaymentDetail(id: string): Promise<{ payment: SupplierPaymentRecord | null; allocations: SupplierPaymentAllocationRecord[]; openInvoices: SupplierInvoiceRecord[] }> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const [payRes, allocRes, invoicesRes] = await Promise.all([
    supabase.from("supplier_payments").select(`*, supplier:supplier_id (name)`).eq("id", id).eq("organization_id", orgId).single(),
    supabase.from("supplier_payment_allocations").select(`*, invoice:invoice_id (invoice_number, total_ttc)`).eq("payment_id", id).eq("organization_id", orgId).is("cancelled_at", null).order("created_at"),
    supabase.from("supplier_invoices").select(SUPPLIER_INVOICE_SELECT).eq("organization_id", orgId).eq("supplier_id", (await supabase.from("supplier_payments").select("supplier_id").eq("id", id).single()).data?.supplier_id ?? "").in("status", ["validated", "partially_paid"]).is("archived_at", null).order("created_at"),
  ]);
  const payment = payRes.data ? { ...payRes.data, supplier_name: (payRes.data as Record<string, unknown>).supplier ? ((payRes.data as Record<string, unknown>).supplier as Record<string, unknown>)["name"] as string : null } as SupplierPaymentRecord : null;
  const allocations = (allocRes.data ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    invoice_number: (a.invoice as Record<string, unknown>)?.["invoice_number"] ?? null,
    invoice_total_ttc: (a.invoice as Record<string, unknown>)?.["total_ttc"] ?? null,
  })) as SupplierPaymentAllocationRecord[];
  const openInvoices = (invoicesRes.data ?? []).map((r: Record<string, unknown>) => mapSupplierInvoice(r));
  return { payment, allocations, openInvoices };
}

export async function getSupplierOpenInvoices(supplierId: string) {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const { data } = await supabase
    .from("supplier_invoices")
    .select(SUPPLIER_INVOICE_SELECT)
    .eq("organization_id", workspace.organization.id)
    .eq("supplier_id", supplierId)
    .in("status", ["validated", "partially_paid"])
    .is("archived_at", null)
    .order("created_at");
  return (data ?? []).map((r: Record<string, unknown>) => mapSupplierInvoice(r));
}

export async function getSupplierInvoiceByReceiptId(receiptId: string): Promise<SupplierInvoiceRecord | null> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const { data } = await supabase
    .from("supplier_invoices")
    .select(SUPPLIER_INVOICE_SELECT)
    .eq("organization_id", workspace.organization.id)
    .eq("source_receipt_id", receiptId)
    .not("status", "eq", "cancelled")
    .maybeSingle();
  return data ? mapSupplierInvoice(data as Record<string, unknown>) : null;
}

export async function getPurchaseProductWithPrice(productId: string) {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const { data } = await supabase
    .from("products")
    .select("id, type, name, sku, purchase_price_ht, tax_rate_id, tax_rate:tax_rate_id(rate), unit_id, unit:unit_id(name, symbol), is_purchasable, track_stock")
    .eq("id", productId)
    .eq("organization_id", workspace.organization.id)
    .single();
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    product_id: d.id as string,
    product_name: d.name as string,
    unit_price_ht: Number(d.purchase_price_ht ?? 0),
    tax_rate_id: d.tax_rate_id as string | null,
    tax_rate: Number((d.tax_rate as Record<string, unknown>)?.["rate"] ?? 0),
    unit_id: d.unit_id as string | null,
    unit_name: (d.unit as Record<string, unknown>)?.["name"] as string | null ?? null,
    unit_symbol: (d.unit as Record<string, unknown>)?.["symbol"] as string | null ?? null,
  };
}
