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
  SupplierInvoicePaymentAttachment,
  SupplierInvoicePaymentSummary,
  SupplierInvoiceReceiptPreparation,
  SupplierInvoiceReceiptPreparationLine,
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

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function relationValue(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return objectValue(value[0]);
  return objectValue(value);
}

function toAmount(value: unknown) {
  return Math.round((Number(value ?? 0) || 0) * 100) / 100;
}

function isCountedSupplierPaymentStatus(status: string | null | undefined) {
  return ["confirmed", "partially_allocated", "allocated", "validated", "paid", "completed", "posted", "reconciled"].includes(String(status ?? "").toLowerCase());
}

export function isSupplierPaymentConfirmedStatus(status: string | null | undefined) {
  if (!status) return true;
  return isCountedSupplierPaymentStatus(status);
}

type SupplierInvoicePaymentsQuery = {
  organizationId: string;
  supplierInvoiceId: string;
  invoiceNumber?: string | null;
  supplierId?: string | null;
  invoiceDate?: string | null;
  totalTtc?: number | null;
  paidAmount?: number | null;
};

type PaymentEnrichment = {
  treasuryTransactionId: string | null;
  accountingEntryId: string | null;
  accountingEntryNumber: string | null;
  accountingEntryStatus: string | null;
};

function emptyEnrichment(): PaymentEnrichment {
  return {
    treasuryTransactionId: null,
    accountingEntryId: null,
    accountingEntryNumber: null,
    accountingEntryStatus: null,
  };
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function scorePossibleSupplierPayment(payment: Record<string, unknown>, args: SupplierInvoicePaymentsQuery) {
  let score = 0;
  const invoiceNumber = normalizeText(args.invoiceNumber).toLowerCase();
  const reference = `${payment.reference ?? ""} ${payment.notes ?? ""} ${payment.payment_number ?? ""}`.toLowerCase();
  const amount = toAmount(payment.amount);
  const targetPaid = toAmount(args.paidAmount);
  const targetTotal = toAmount(args.totalTtc);

  if (invoiceNumber && reference.includes(invoiceNumber)) score += 70;
  if (targetPaid > 0 && Math.abs(amount - targetPaid) <= 0.01) score += 35;
  else if (targetTotal > 0 && Math.abs(amount - targetTotal) <= 0.01) score += 30;
  else if (targetPaid > 0 && Math.abs(amount - targetPaid) <= Math.max(targetPaid * 0.05, 20)) score += 18;
  else if (targetTotal > 0 && Math.abs(amount - targetTotal) <= Math.max(targetTotal * 0.05, 20)) score += 15;

  const invoiceTime = args.invoiceDate ? new Date(args.invoiceDate).getTime() : NaN;
  const paymentTime = payment.payment_date ? new Date(String(payment.payment_date)).getTime() : NaN;
  if (Number.isFinite(invoiceTime) && Number.isFinite(paymentTime)) {
    const daysAfterInvoice = (paymentTime - invoiceTime) / 86400000;
    if (daysAfterInvoice >= 0 && daysAfterInvoice <= 90) score += 15;
    else if (daysAfterInvoice >= -15 && daysAfterInvoice < 0) score += 5;
  }

  return score;
}

function paymentAttachmentKey(payment: SupplierInvoicePaymentAttachment) {
  return `${payment.source}:${payment.id}:${payment.allocation_id}`;
}

function computeSupplierInvoicePaymentSummary(
  invoice: SupplierInvoiceRecord,
  payments: SupplierInvoicePaymentAttachment[],
): SupplierInvoicePaymentSummary {
  const invoiceTotalTtc = toAmount(invoice.total_ttc);
  const paidAmount = toAmount(payments.filter((payment) => payment.counted_in_paid_total).reduce((sum, payment) => sum + payment.amount, 0));
  const remainingAmount = Math.max(toAmount(invoiceTotalTtc - paidAmount), 0);
  const overpaidAmount = Math.max(toAmount(paidAmount - invoiceTotalTtc), 0);
  const tolerance = 0.01;
  const paymentStatus =
    paidAmount <= tolerance
      ? "unpaid"
      : paidAmount < invoiceTotalTtc - tolerance
        ? "partial"
        : paidAmount > invoiceTotalTtc + tolerance
          ? "overpaid"
          : "paid";
  const paymentStatusComputed = paymentStatus === "partial" ? "partially_paid" : paymentStatus;
  const normalizedStored =
    invoice.payment_status === "unpaid"
      ? "unpaid"
      : invoice.payment_status === "partial"
        ? "partial"
        : "paid";
  const storedPaidAmount = toAmount(invoice.paid_amount);
  const storedRemainingAmount = toAmount(invoice.remaining_amount);
  const hasPaymentInconsistency =
    ((invoice.payment_status === "paid" || invoice.payment_status === "partial") && paidAmount <= tolerance) ||
    (storedPaidAmount > tolerance && paidAmount <= tolerance) ||
    Math.abs(storedPaidAmount - paidAmount) > tolerance ||
    Math.abs(storedRemainingAmount - remainingAmount) > tolerance ||
    normalizedStored !== (paymentStatus === "overpaid" ? "paid" : paymentStatus);

  return {
    invoiceId: invoice.id,
    invoiceTotalTtc,
    totalTtc: invoiceTotalTtc,
    confirmedPaidAmount: paidAmount,
    paidAmount,
    remainingAmount,
    overpaidAmount,
    paymentStatus,
    computedPaymentStatus: paymentStatusComputed,
    paymentStatusComputed,
    storedPaidAmount,
    storedRemainingAmount,
    hasPaymentInconsistency,
    canRegisterPayment: paymentStatus !== "paid" && paymentStatus !== "overpaid",
    maxPaymentAmount: remainingAmount,
    storedPaymentStatus: invoice.payment_status,
    isInconsistentWithStoredStatus: hasPaymentInconsistency,
  };
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

export async function getPurchaseReceiptArchiveEligibility(receiptId: string) {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const { data: receipt } = await supabase
    .from("purchase_documents")
    .select("id, status, stock_updated_at")
    .eq("id", receiptId)
    .eq("organization_id", orgId)
    .eq("document_type", "supplier_receipt")
    .maybeSingle();

  if (!receipt) {
    return {
      canArchive: false,
      reasons: ["Réception introuvable"],
      isValidated: false,
      isInvoiced: false,
      hasStockImpact: false,
    };
  }

  const [{ data: directInvoices }, { data: lineInvoices }, { data: receiptLines }, { data: stockMoves }] = await Promise.all([
    supabase
      .from("supplier_invoices")
      .select("id")
      .eq("organization_id", orgId)
      .eq("source_receipt_id", receiptId)
      .not("status", "eq", "cancelled")
      .limit(1),
    supabase
      .from("supplier_invoice_lines")
      .select("id")
      .eq("organization_id", orgId)
      .eq("source_document_id", receiptId)
      .limit(1),
    supabase
      .from("purchase_document_lines")
      .select("id")
      .eq("organization_id", orgId)
      .eq("document_id", receiptId),
    supabase
      .from("stock_moves")
      .select("id")
      .eq("organization_id", orgId)
      .eq("source_document_id", receiptId)
      .limit(1),
  ]);

  const receiptLineIds = (receiptLines ?? []).map((line: { id: string }) => line.id);
  let hasLineInvoiceBySourceLine = false;
  if (receiptLineIds.length > 0) {
    const { data } = await supabase
      .from("supplier_invoice_lines")
      .select("id")
      .eq("organization_id", orgId)
      .in("source_line_id", receiptLineIds)
      .limit(1);
    hasLineInvoiceBySourceLine = (data ?? []).length > 0;
  }

  const guardedStatuses = ["validated", "received", "delivered", "invoiced", "partially_invoiced"];
  const isValidated = guardedStatuses.includes(String(receipt.status));
  const isInvoiced = (directInvoices ?? []).length > 0 || (lineInvoices ?? []).length > 0 || hasLineInvoiceBySourceLine;
  const hasStockImpact = Boolean(receipt.stock_updated_at) || (stockMoves ?? []).length > 0;
  const reasons = [
    isValidated ? "Réception validée" : null,
    isInvoiced ? "Réception déjà facturée" : null,
    hasStockImpact ? "Stock déjà impacté" : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    canArchive: reasons.length === 0,
    reasons,
    isValidated,
    isInvoiced,
    hasStockImpact,
  };
}

export async function getStockMovesForReceipt(receiptId: string): Promise<{ id: string; product_name: string | null; quantity: number; direction: string; move_type: string; warehouse_name: string | null; movement_date: string | null }[]> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const { data, error } = await supabase
    .from("stock_moves")
    .select("id, quantity, direction, move_type, movement_date, warehouse_id, product:product_id(name), warehouse:warehouse_id(name)")
    .eq("organization_id", orgId)
    .eq("source_document_id", receiptId)
    .order("movement_date", { ascending: false });

  if (error) {
    console.error("getStockMovesForReceipt error:", error.message);
    return [];
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((row) => {
    const product = relationValue(row.product);
    const warehouse = relationValue(row.warehouse);
    return {
      id: String(row.id),
      product_name: (product?.name as string) ?? null,
      quantity: Number(row.quantity ?? 0),
      direction: String(row.direction ?? "in"),
      move_type: String(row.move_type ?? "purchase_receipt"),
      warehouse_name: (warehouse?.name as string) ?? null,
      movement_date: (row.movement_date as string) ?? null,
    };
  });
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

function calculateInvoicePrepLine(line: { quantity: number; unitPriceHt: number; discountRate: number; taxRate: number }) {
  const baseHt = line.quantity * line.unitPriceHt;
  const discountAmount = toAmount(baseHt * (line.discountRate / 100));
  const subtotalHt = toAmount(baseHt - discountAmount);
  const taxAmount = toAmount(subtotalHt * (line.taxRate / 100));
  const totalTtc = toAmount(subtotalHt + taxAmount);
  return { subtotalHt, discountAmount, taxAmount, totalTtc };
}

export async function getSupplierInvoicePreparationFromReceipt(receiptId: string): Promise<SupplierInvoiceReceiptPreparation | null> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const { data: receiptRaw } = await supabase
    .from("purchase_documents")
    .select(PURCHASE_DOCUMENT_SELECT)
    .eq("organization_id", orgId)
    .eq("id", receiptId)
    .eq("document_type", "supplier_receipt")
    .is("archived_at", null)
    .maybeSingle();
  if (!receiptRaw) return null;

  const receipt = mapPurchaseDocument(receiptRaw as Record<string, unknown>);
  const { data: receiptLinesRaw } = await supabase
    .from("purchase_document_lines")
    .select(PURCHASE_DOCUMENT_LINE_SELECT)
    .eq("organization_id", orgId)
    .eq("document_id", receiptId)
    .order("line_order");
  const receiptLines = (receiptLinesRaw ?? []) as Record<string, unknown>[];
  const sourceOrderLineIds = receiptLines.map((line) => normalizeText(line.source_line_id)).filter(Boolean);
  const productIds = receiptLines.map((line) => normalizeText(line.product_id)).filter(Boolean);

  const [orderLinesRes, productsRes, defaultTaxRes, existingInvoiceLinesRes, sourceOrderRes] = await Promise.all([
    sourceOrderLineIds.length ? supabase.from("purchase_document_lines").select(PURCHASE_DOCUMENT_LINE_SELECT).eq("organization_id", orgId).in("id", sourceOrderLineIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabase.from("products").select("id, name, description, unit_id, purchase_price_ht, tax_rate_id, unit:unit_id(name, symbol), tax_rate:tax_rate_id(name, rate)").eq("organization_id", orgId).in("id", productIds) : Promise.resolve({ data: [] }),
    supabase.from("tax_rates").select("id, name, rate").eq("organization_id", orgId).eq("rate", 20).is("archived_at", null).limit(1).maybeSingle(),
    supabase.from("supplier_invoice_lines").select("source_line_id, quantity").eq("organization_id", orgId).eq("source_document_id", receiptId),
    receipt.related_order_id ? supabase.from("purchase_documents").select(PURCHASE_DOCUMENT_SELECT).eq("organization_id", orgId).eq("id", receipt.related_order_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const orderLinesById = new Map(((orderLinesRes.data ?? []) as Record<string, unknown>[]).map((line) => [String(line.id), line]));
  const productsById = new Map(((productsRes.data ?? []) as Record<string, unknown>[]).map((product) => [String(product.id), product]));
  const alreadyInvoicedByReceiptLine = new Map<string, number>();
  for (const line of (existingInvoiceLinesRes.data ?? []) as Record<string, unknown>[]) {
    const sourceLineId = normalizeText(line.source_line_id);
    if (!sourceLineId) continue;
    alreadyInvoicedByReceiptLine.set(sourceLineId, (alreadyInvoicedByReceiptLine.get(sourceLineId) ?? 0) + toAmount(line.quantity));
  }

  const warnings: string[] = [];
  const preparedLines: SupplierInvoiceReceiptPreparationLine[] = [];

  for (const receiptLine of receiptLines) {
    const sourceOrderLineId = normalizeText(receiptLine.source_line_id) || null;
    const orderLine = sourceOrderLineId ? orderLinesById.get(sourceOrderLineId) : null;
    const productId = normalizeText(receiptLine.product_id || orderLine?.product_id) || "";
    const product = productId ? productsById.get(productId) : null;
    const productUnit = relationValue(product?.unit);
    const productTax = relationValue(product?.tax_rate);
    const alreadyInvoiced = alreadyInvoicedByReceiptLine.get(String(receiptLine.id)) ?? 0;
    const quantity = Math.max(toAmount(receiptLine.quantity) - alreadyInvoiced, 0);
    if (quantity <= 0) continue;

    const unitId = normalizeText(receiptLine.unit_id) || normalizeText(orderLine?.unit_id) || normalizeText(product?.unit_id) || "";
    const unitName = normalizeText(receiptLine.unit_name) || normalizeText(orderLine?.unit_name) || normalizeText(productUnit?.symbol) || normalizeText(productUnit?.name) || "UN";
    const unitPriceHt = toAmount(receiptLine.unit_price_ht) || toAmount(orderLine?.unit_price_ht) || toAmount(product?.purchase_price_ht);
    const discountRate = toAmount(receiptLine.discount_rate) || toAmount(orderLine?.discount_rate);
    const taxRateId = normalizeText(receiptLine.tax_rate_id) || normalizeText(orderLine?.tax_rate_id) || normalizeText(product?.tax_rate_id) || normalizeText(defaultTaxRes.data?.id) || "";
    const taxRate = toAmount(receiptLine.tax_rate) || toAmount(orderLine?.tax_rate) || toAmount(productTax?.rate) || toAmount(defaultTaxRes.data?.rate);
    const totals = calculateInvoicePrepLine({ quantity, unitPriceHt, discountRate, taxRate });
    const lineWarnings: string[] = [];
    if (!unitId && !unitName) lineWarnings.push("Unité manquante");
    if (unitPriceHt <= 0) lineWarnings.push("Prix HT manquant : à compléter avant validation.");
    if (!taxRateId && taxRate <= 0) lineWarnings.push("TVA manquante : à compléter avant validation.");
    if (lineWarnings.length > 0) warnings.push(`${normalizeText(receiptLine.product_name) || normalizeText(receiptLine.description) || "Ligne"} : ${lineWarnings.join(", ")}`);

    preparedLines.push({
      id: String(receiptLine.id),
      mode: productId ? "product" : "free",
      sourceReceiptLineId: String(receiptLine.id),
      sourceReceiptId: receiptId,
      sourceOrderLineId,
      product_id: productId,
      product_name: normalizeText(receiptLine.product_name) || normalizeText(orderLine?.product_name) || normalizeText(product?.name),
      description: normalizeText(receiptLine.description) || normalizeText(orderLine?.description) || normalizeText(product?.description) || normalizeText(product?.name),
      quantity,
      unit_id: unitId,
      unit_name: unitName,
      unitLabel: unitName,
      unit_price_ht: unitPriceHt,
      discount_rate: discountRate,
      tax_rate_id: taxRateId,
      tax_rate: taxRate,
      taxLabel: taxRate ? `${taxRate}%` : null,
      subtotal_ht: totals.subtotalHt,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      total_ttc: totals.totalTtc,
      totalHt: totals.subtotalHt,
      totalTax: totals.taxAmount,
      totalTtc: totals.totalTtc,
      source_line_id: String(receiptLine.id),
      source_document_id: receiptId,
      warning: lineWarnings.join(" ") || null,
    });
  }

  return {
    receipt,
    supplier: receipt.supplier_id ? { id: receipt.supplier_id, name: receipt.supplier_name ?? null, ice: receipt.supplier_ice ?? null } : null,
    sourcePurchaseOrder: sourceOrderRes.data ? mapPurchaseDocument(sourceOrderRes.data as Record<string, unknown>) : null,
    lines: preparedLines,
    totals: {
      subtotalHt: toAmount(preparedLines.reduce((sum, line) => sum + line.subtotal_ht, 0)),
      discountTotal: toAmount(preparedLines.reduce((sum, line) => sum + line.discount_amount, 0)),
      taxTotal: toAmount(preparedLines.reduce((sum, line) => sum + line.tax_amount, 0)),
      totalTtc: toAmount(preparedLines.reduce((sum, line) => sum + line.total_ttc, 0)),
    },
    warnings,
  };
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

async function getSupplierPaymentEnrichments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  paymentIds: string[],
) {
  if (paymentIds.length === 0) return new Map<string, PaymentEnrichment>();

  const [txRes, entryRes] = await Promise.all([
    supabase
      .from("treasury_transactions")
      .select("id, supplier_payment_id")
      .eq("organization_id", organizationId)
      .in("supplier_payment_id", paymentIds)
      .is("archived_at", null),
    supabase
      .from("accounting_entries")
      .select("id, entry_number, status, source_document_id")
      .eq("organization_id", organizationId)
      .eq("source_document_type", "supplier_payment")
      .in("source_document_id", paymentIds)
      .neq("status", "cancelled"),
  ]);

  const enrichments = new Map<string, PaymentEnrichment>();
  for (const paymentId of paymentIds) enrichments.set(paymentId, emptyEnrichment());

  for (const tx of (txRes.data ?? []) as Record<string, unknown>[]) {
    const paymentId = normalizeText(tx.supplier_payment_id);
    if (!paymentId) continue;
    enrichments.set(paymentId, {
      ...(enrichments.get(paymentId) ?? emptyEnrichment()),
      treasuryTransactionId: normalizeText(tx.id) || null,
    });
  }

  for (const entry of (entryRes.data ?? []) as Record<string, unknown>[]) {
    const paymentId = normalizeText(entry.source_document_id);
    if (!paymentId) continue;
    enrichments.set(paymentId, {
      ...(enrichments.get(paymentId) ?? emptyEnrichment()),
      accountingEntryId: normalizeText(entry.id) || null,
      accountingEntryNumber: normalizeText(entry.entry_number) || null,
      accountingEntryStatus: normalizeText(entry.status) || null,
    });
  }

  return enrichments;
}

function supplierPaymentToAttachment({
  payment,
  allocation,
  enrichment,
  amount,
  source,
  matchStatus,
  matchScore = null,
}: {
  payment: Record<string, unknown>;
  allocation?: Record<string, unknown> | null;
  enrichment?: PaymentEnrichment;
  amount?: number | null;
  source: SupplierInvoicePaymentAttachment["source"];
  matchStatus: SupplierInvoicePaymentAttachment["matchStatus"];
  matchScore?: number | null;
}): SupplierInvoicePaymentAttachment | null {
  if (!payment.id || payment.archived_at) return null;
  const account = relationValue(payment.treasury_account);
  const status = normalizeText(payment.status) || "confirmed";
  const paymentId = String(payment.id);
  const data = enrichment ?? emptyEnrichment();
  return {
    id: paymentId,
    allocation_id: normalizeText(allocation?.id) || paymentId,
    payment_number: normalizeText(payment.payment_number) || normalizeText(payment.number) || "-",
    payment_date: normalizeText(payment.payment_date) || normalizeText(allocation?.allocation_date) || null,
    amount: toAmount(amount ?? allocation?.amount ?? payment.amount),
    payment_method: normalizeText(payment.payment_method) || null,
    status,
    treasury_account_id: normalizeText(payment.treasury_account_id) || null,
    treasury_account_name: normalizeText(account?.name) || null,
    treasury_account_type: normalizeText(account?.account_type) || null,
    reference: normalizeText(payment.reference) || normalizeText(payment.transfer_reference) || normalizeText(payment.check_number) || null,
    notes: normalizeText(allocation?.notes) || normalizeText(payment.notes) || null,
    treasury_transaction_id: data.treasuryTransactionId,
    accounting_entry_id: data.accountingEntryId,
    accounting_entry_number: data.accountingEntryNumber,
    accounting_entry_status: data.accountingEntryStatus,
    created_at: normalizeText(payment.created_at) || normalizeText(allocation?.created_at) || null,
    counted_in_paid_total: matchStatus === "confirmed" && isCountedSupplierPaymentStatus(status),
    source,
    matchStatus,
    matchScore,
  };
}

export async function getSupplierInvoicePayments({
  organizationId,
  supplierInvoiceId,
  invoiceNumber,
  supplierId,
  invoiceDate,
  totalTtc,
  paidAmount,
}: SupplierInvoicePaymentsQuery): Promise<SupplierInvoicePaymentAttachment[]> {
  const supabase = await createClient();
  const attachments = new Map<string, SupplierInvoicePaymentAttachment>();

  const allocationsRes = await supabase
    .from("supplier_payment_allocations")
    .select(`
      id, payment_id, invoice_id, amount, allocation_date, notes, created_at, cancelled_at,
      payment:payment_id (
        id, payment_number, payment_date, payment_method, status, treasury_account_id,
        reference, transfer_reference, check_number, notes, amount, created_at, archived_at,
        treasury_account:treasury_account_id (id, name, account_type)
      )
    `)
    .eq("invoice_id", supplierInvoiceId)
    .eq("organization_id", organizationId)
    .is("cancelled_at", null)
    .order("allocation_date", { ascending: false });

  const allocationRows = (allocationsRes.data ?? []) as Record<string, unknown>[];
  const allocationPaymentIds = allocationRows
    .map((allocation) => normalizeText(relationValue(allocation.payment)?.id))
    .filter(Boolean);
  const allocationEnrichments = await getSupplierPaymentEnrichments(supabase, organizationId, allocationPaymentIds);

  for (const allocation of allocationRows) {
    const payment = relationValue(allocation.payment);
    if (!payment) continue;
    const paymentId = normalizeText(payment.id);
    const attachment = supplierPaymentToAttachment({
      payment,
      allocation,
      enrichment: allocationEnrichments.get(paymentId),
      source: "supplier_payment_allocations",
      matchStatus: "confirmed",
    });
    if (attachment) attachments.set(paymentAttachmentKey(attachment), attachment);
  }

  const directTreasuryRes = await supabase
    .from("treasury_transactions")
    .select(`
      id, treasury_account_id, supplier_payment_id, supplier_invoice_id, transaction_date,
      amount, reference, description, label, reconciliation_status, created_at, archived_at,
      account:treasury_account_id (id, name, account_type)
    `)
    .eq("organization_id", organizationId)
    .eq("supplier_invoice_id", supplierInvoiceId)
    .is("archived_at", null)
    .order("transaction_date", { ascending: false });

  for (const tx of (directTreasuryRes.data ?? []) as Record<string, unknown>[]) {
    if (tx.supplier_payment_id) continue;
    const account = relationValue(tx.account);
    const attachment: SupplierInvoicePaymentAttachment = {
      id: String(tx.id),
      allocation_id: String(tx.id),
      payment_number: normalizeText(tx.reference) || normalizeText(tx.label) || "Mouvement tresorerie",
      payment_date: normalizeText(tx.transaction_date) || null,
      amount: toAmount(tx.amount),
      payment_method: null,
      status: normalizeText(tx.reconciliation_status) || "confirmed",
      treasury_account_id: normalizeText(tx.treasury_account_id) || null,
      treasury_account_name: normalizeText(account?.name) || null,
      treasury_account_type: normalizeText(account?.account_type) || null,
      reference: normalizeText(tx.reference) || null,
      notes: normalizeText(tx.description) || normalizeText(tx.label) || null,
      treasury_transaction_id: String(tx.id),
      accounting_entry_id: null,
      accounting_entry_number: null,
      accounting_entry_status: null,
      created_at: normalizeText(tx.created_at) || null,
      counted_in_paid_total: true,
      source: "treasury_transactions",
      matchStatus: "confirmed",
      matchScore: null,
    };
    attachments.set(paymentAttachmentKey(attachment), attachment);
  }

  if (supplierId) {
    const supplierPaymentsRes = await supabase
      .from("supplier_payments")
      .select(`
        id, payment_number, supplier_id, payment_date, payment_method, status,
        treasury_account_id, reference, transfer_reference, check_number,
        notes, amount, allocated_amount, available_amount, created_at, archived_at,
        treasury_account:treasury_account_id (id, name, account_type)
      `)
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .is("archived_at", null)
      .order("payment_date", { ascending: false })
      .limit(100);

    const existingPaymentIds = new Set(
      Array.from(attachments.values())
        .filter((payment) => payment.source !== "treasury_transactions")
        .map((payment) => payment.id),
    );
    const possiblePayments = ((supplierPaymentsRes.data ?? []) as Record<string, unknown>[])
      .filter((payment) => !existingPaymentIds.has(String(payment.id)))
      .map((payment) => ({ payment, score: scorePossibleSupplierPayment(payment, { organizationId, supplierInvoiceId, invoiceNumber, supplierId, invoiceDate, totalTtc, paidAmount }) }))
      .filter(({ payment, score }) => score >= 30 && !["draft", "cancelled", "canceled", "rejected", "archived", "void"].includes(normalizeText(payment.status).toLowerCase()))
      .slice(0, 8);

    const possibleIds = possiblePayments.map(({ payment }) => String(payment.id));
    const possibleEnrichments = await getSupplierPaymentEnrichments(supabase, organizationId, possibleIds);
    for (const { payment, score } of possiblePayments) {
      const attachment = supplierPaymentToAttachment({
        payment,
        enrichment: possibleEnrichments.get(String(payment.id)),
        source: "possible_match",
        matchStatus: "possible_match",
        matchScore: score,
      });
      if (attachment) attachments.set(paymentAttachmentKey(attachment), attachment);
    }
  }

  if (invoiceNumber) {
    const cleanInvoiceNumber = invoiceNumber.replace(/[(),]/g, " ").trim();
    if (cleanInvoiceNumber) {
      const txByReferenceRes = await supabase
        .from("treasury_transactions")
        .select(`
          id, treasury_account_id, supplier_payment_id, supplier_invoice_id, transaction_date,
          amount, reference, description, label, reconciliation_status, third_party_id, created_at, archived_at,
          account:treasury_account_id (id, name, account_type)
        `)
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .or(`reference.ilike.%${cleanInvoiceNumber}%,description.ilike.%${cleanInvoiceNumber}%,label.ilike.%${cleanInvoiceNumber}%`)
        .limit(20);

      for (const tx of (txByReferenceRes.data ?? []) as Record<string, unknown>[]) {
        if (tx.supplier_invoice_id === supplierInvoiceId || tx.supplier_payment_id) continue;
        if (supplierId && tx.third_party_id && tx.third_party_id !== supplierId) continue;
        const account = relationValue(tx.account);
        const attachment: SupplierInvoicePaymentAttachment = {
          id: String(tx.id),
          allocation_id: String(tx.id),
          payment_number: normalizeText(tx.reference) || normalizeText(tx.label) || "Mouvement tresorerie",
          payment_date: normalizeText(tx.transaction_date) || null,
          amount: toAmount(tx.amount),
          payment_method: null,
          status: normalizeText(tx.reconciliation_status) || "confirmed",
          treasury_account_id: normalizeText(tx.treasury_account_id) || null,
          treasury_account_name: normalizeText(account?.name) || null,
          treasury_account_type: normalizeText(account?.account_type) || null,
          reference: normalizeText(tx.reference) || null,
          notes: normalizeText(tx.description) || normalizeText(tx.label) || null,
          treasury_transaction_id: String(tx.id),
          accounting_entry_id: null,
          accounting_entry_number: null,
          accounting_entry_status: null,
          created_at: normalizeText(tx.created_at) || null,
          counted_in_paid_total: false,
          source: "possible_match",
          matchStatus: "possible_match",
          matchScore: 70,
        };
        attachments.set(paymentAttachmentKey(attachment), attachment);
      }
    }
  }

  return Array.from(attachments.values()).sort((a, b) => {
    if (a.matchStatus !== b.matchStatus) return a.matchStatus === "confirmed" ? -1 : 1;
    return String(b.payment_date ?? b.created_at ?? "").localeCompare(String(a.payment_date ?? a.created_at ?? ""));
  });
}

export async function getSupplierInvoiceAttachedPayments({
  organizationId,
  supplierInvoiceId,
}: {
  organizationId: string;
  supplierInvoiceId: string;
}): Promise<SupplierInvoicePaymentAttachment[]> {
  const supabase = await createClient();
  const allocationsRes = await supabase
    .from("supplier_payment_allocations")
    .select(`
      id, payment_id, invoice_id, amount, allocation_date, notes, created_at, cancelled_at,
      payment:payment_id (
        id, payment_number, payment_date, payment_method, status, treasury_account_id,
        reference, transfer_reference, check_number, notes, amount, created_at, archived_at,
        treasury_account:treasury_account_id (id, name, account_type)
      )
    `)
    .eq("invoice_id", supplierInvoiceId)
    .eq("organization_id", organizationId)
    .is("cancelled_at", null)
    .order("allocation_date", { ascending: false });

  const allocationRows = (allocationsRes.data ?? []) as Record<string, unknown>[];
  const paymentIds = allocationRows
    .map((allocation) => normalizeText(relationValue(allocation.payment)?.id))
    .filter(Boolean);
  const enrichments = await getSupplierPaymentEnrichments(supabase, organizationId, paymentIds);
  const payments = allocationRows
    .map((allocation) => {
      const payment = relationValue(allocation.payment);
      if (!payment) return null;
      return supplierPaymentToAttachment({
        payment,
        allocation,
        enrichment: enrichments.get(normalizeText(payment.id)),
        source: "supplier_payment_allocations",
        matchStatus: "confirmed",
      });
    })
    .filter((payment): payment is SupplierInvoicePaymentAttachment => Boolean(payment));

  const directTreasuryRes = await supabase
    .from("treasury_transactions")
    .select(`
      id, treasury_account_id, supplier_payment_id, supplier_invoice_id, transaction_date,
      amount, reference, description, label, reconciliation_status, created_at, archived_at,
      account:treasury_account_id (id, name, account_type)
    `)
    .eq("organization_id", organizationId)
    .eq("supplier_invoice_id", supplierInvoiceId)
    .is("archived_at", null)
    .order("transaction_date", { ascending: false });

  const paymentIdsFromAllocations = new Set(paymentIds);
  for (const tx of (directTreasuryRes.data ?? []) as Record<string, unknown>[]) {
    if (tx.supplier_payment_id && paymentIdsFromAllocations.has(String(tx.supplier_payment_id))) continue;
    const account = relationValue(tx.account);
    const status = normalizeText(tx.reconciliation_status) || "confirmed";
    payments.push({
      id: String(tx.id),
      allocation_id: String(tx.id),
      payment_number: normalizeText(tx.reference) || normalizeText(tx.label) || "Mouvement tresorerie",
      payment_date: normalizeText(tx.transaction_date) || null,
      amount: toAmount(tx.amount),
      payment_method: null,
      status,
      treasury_account_id: normalizeText(tx.treasury_account_id) || null,
      treasury_account_name: normalizeText(account?.name) || null,
      treasury_account_type: normalizeText(account?.account_type) || null,
      reference: normalizeText(tx.reference) || null,
      notes: normalizeText(tx.description) || normalizeText(tx.label) || null,
      treasury_transaction_id: String(tx.id),
      accounting_entry_id: null,
      accounting_entry_number: null,
      accounting_entry_status: null,
      created_at: normalizeText(tx.created_at) || null,
      counted_in_paid_total: isSupplierPaymentConfirmedStatus(status),
      source: "treasury_transactions",
      matchStatus: "confirmed",
      matchScore: null,
    });
  }

  return payments
    .filter((payment) => payment.matchStatus === "confirmed")
    .sort((a, b) => String(b.payment_date ?? b.created_at ?? "").localeCompare(String(a.payment_date ?? a.created_at ?? "")));
}

export async function getSupplierInvoicePaymentSummary({
  organizationId,
  supplierInvoiceId,
}: {
  organizationId: string;
  supplierInvoiceId: string;
}) {
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("supplier_invoices")
    .select(SUPPLIER_INVOICE_SELECT)
    .eq("id", supplierInvoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!invoice) return null;
  const mappedInvoice = mapSupplierInvoice(invoice as Record<string, unknown>);
  const payments = await getSupplierInvoiceAttachedPayments({ organizationId, supplierInvoiceId });
  return {
    ...computeSupplierInvoicePaymentSummary(mappedInvoice, payments),
    payments,
  };
}

export async function getSupplierInvoiceDetail(id: string): Promise<{
  invoice: SupplierInvoiceRecord | null;
  lines: SupplierInvoiceLineRecord[];
  payments: SupplierInvoicePaymentAttachment[];
  paymentSummary: SupplierInvoicePaymentSummary | null;
}> {
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const [invRes, linesRes] = await Promise.all([
    supabase.from("supplier_invoices").select(SUPPLIER_INVOICE_SELECT).eq("id", id).eq("organization_id", orgId).single(),
    supabase.from("supplier_invoice_lines").select(SUPPLIER_INVOICE_LINE_SELECT).eq("invoice_id", id).eq("organization_id", orgId).order("line_order"),
  ]);
  if (invRes.error) return { invoice: null, lines: [], payments: [], paymentSummary: null };

  const invoice = mapSupplierInvoice(invRes.data as Record<string, unknown>);
  const payments = await getSupplierInvoiceAttachedPayments({
    organizationId: orgId,
    supplierInvoiceId: id,
  });

  return {
    invoice,
    lines: (linesRes.data ?? []) as SupplierInvoiceLineRecord[],
    payments,
    paymentSummary: computeSupplierInvoicePaymentSummary(invoice, payments),
  };
}

function supplierInvoiceStep(invoice: SupplierInvoiceRecord, displayStatus?: string): DocumentFlowStep {
  return {
    label: "Facture fournisseur",
    number: invoice.invoice_number,
    href: `/achats/factures/${invoice.id}`,
    status: displayStatus ?? invoice.status,
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
  const { invoice, lines, paymentSummary } = await getSupplierInvoiceDetail(invoiceId);
  if (!invoice) return [];
  const displayStatus = paymentSummary?.hasPaymentInconsistency && ["paid", "partially_paid"].includes(invoice.status) ? "validated" : invoice.status;

  const receiptIds = Array.from(new Set([invoice.source_receipt_id, ...lines.map((line) => line.source_document_id)].filter(Boolean))) as string[];
  if (receiptIds.length === 1) {
    const sourceFlow = await getPurchaseDocumentFlow(receiptIds[0]);
    return [...sourceFlow.map((step) => ({ ...step, isCurrent: false })), supplierInvoiceStep(invoice, displayStatus)];
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
      supplierInvoiceStep(invoice, displayStatus),
    ];
  }

  return [supplierInvoiceStep(invoice, displayStatus)];
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
