"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { getDefaultStockLocationId } from "@/lib/stock-locations";
import { createTreasuryTransactionFromPayment } from "@/lib/treasury-actions";
import { isSupplierInvoiceFromReceipt, type PurchaseActionResult } from "@/lib/purchase-types";
import { getPurchaseReceiptArchiveEligibility, getSupplierInvoicePaymentSummary, getSupplierInvoicePreparationFromReceipt, getSupplierOrderLineProgress } from "@/lib/purchases";

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function numberOrZero(formData: FormData, key: string): number {
  return numberValue(formData.get(key));
}

function parseJsonLines(formData: FormData, key: string): Record<string, unknown>[] {
  try {
    const raw = formData.get(key);
    if (!raw || typeof raw !== "string") return [];
    return JSON.parse(raw) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

function calculatePurchaseLine(line: Record<string, unknown>): Record<string, unknown> {
  const quantity = numberValue(line.quantity);
  const unitPriceHt = numberValue(line.unit_price_ht);
  const discountRate = numberValue(line.discount_rate);
  const taxRate = numberValue(line.tax_rate);
  const subtotalHt = quantity * unitPriceHt;
  const discountAmount = subtotalHt * (discountRate / 100);
  const afterDiscount = subtotalHt - discountAmount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const totalTtc = afterDiscount + taxAmount;
  return {
    ...line,
    quantity,
    unit_price_ht: unitPriceHt,
    discount_rate: discountRate,
    tax_rate: taxRate,
    subtotal_ht: subtotalHt,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_ttc: totalTtc,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function validateUnits(lines: Record<string, unknown>[]): string | null {
  for (const line of lines) {
    const quantity = numberValue(line.quantity);
    const unitName = (line.unit_name as string) ?? "";
    if (unitName.toLowerCase() === "u" && !Number.isInteger(quantity)) {
      return `La quantite de "${line.description || line.product_name}" doit etre un nombre entier (unite ${unitName}).`;
    }
    if (quantity <= 0) {
      return `La quantite de "${line.description || line.product_name}" doit etre supérieure a 0.`;
    }
  }
  return null;
}

// ============================================================================
// Helper to create/update purchase document lines
// ============================================================================
async function insertPurchaseLines(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  documentId: string,
  orgId: string,
  lines: Record<string, unknown>[],
) {
  const calculated = lines.map((line, index) => {
    const calc = calculatePurchaseLine(line);
    return {
      organization_id: orgId,
      document_id: documentId,
      line_order: index + 1,
      product_id: (calc.product_id as string) || null,
      product_name: (calc.product_name as string) || null,
      description: (calc.description as string) || "",
      quantity: calc.quantity as number,
      unit_id: (calc.unit_id as string) || null,
      unit_name: (calc.unit_name as string) || null,
      unit_price_ht: calc.unit_price_ht as number,
      discount_rate: calc.discount_rate as number,
      tax_rate_id: (calc.tax_rate_id as string) || null,
      tax_rate: calc.tax_rate as number,
      subtotal_ht: calc.subtotal_ht as number,
      discount_amount: calc.discount_amount as number,
      tax_amount: calc.tax_amount as number,
      total_ttc: calc.total_ttc as number,
      ordered_quantity: (calc.ordered_quantity as number) ?? (calc.quantity as number),
      received_quantity: (calc.received_quantity as number) ?? 0,
      remaining_quantity: (calc.remaining_quantity as number) ?? null,
    };
  });
  const { error } = await supabase.from("purchase_document_lines").insert(calculated);
  if (error) throw new Error(error.message);
  return calculated;
}

async function updatePurchaseTotals(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, documentId: string) {
  const { data: lines } = await supabase.from("purchase_document_lines").select("subtotal_ht, discount_amount, tax_amount, total_ttc").eq("document_id", documentId);
  if (!lines) return;
  const subtotalHt = lines.reduce((s, l) => s + Number(l.subtotal_ht), 0);
  const discountTotal = lines.reduce((s, l) => s + Number(l.discount_amount), 0);
  const taxTotal = lines.reduce((s, l) => s + Number(l.tax_amount), 0);
  const totalTtc = lines.reduce((s, l) => s + Number(l.total_ttc), 0);
  await supabase.from("purchase_documents").update({ subtotal_ht: subtotalHt, discount_total: discountTotal, tax_total: taxTotal, total_ttc: totalTtc }).eq("id", documentId);
}

// ============================================================================
// Supplier Orders
// ============================================================================
export async function createSupplierOrder(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const supplierId = text(formData, "supplier_id");
  if (!supplierId) return { success: false, error: "Veuillez selectionner un fournisseur." };

  const documentDate = text(formData, "document_date") ?? new Date().toISOString().slice(0, 10);
  const expectedReceiptDate = text(formData, "expected_receipt_date");
  const notes = text(formData, "notes");
  const internalNotes = text(formData, "internal_notes");

  const lines = parseJsonLines(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Ajoutez au moins une ligne." };

  const unitError = validateUnits(lines);
  if (unitError) return { success: false, error: unitError };

  const { data: doc, error: docError } = await supabase
    .from("purchase_documents")
    .insert({ organization_id: orgId, document_type: "supplier_order", document_number: "", supplier_id: supplierId, document_date: documentDate, expected_receipt_date: expectedReceiptDate, notes, internal_notes: internalNotes, status: "draft" })
    .select("id, document_number")
    .single();
  if (docError) return { success: false, error: docError.message };
  if (!doc) return { success: false, error: "Erreur creation commande." };

  try {
    await insertPurchaseLines(supabase as never, doc.id, orgId, lines);
    await updatePurchaseTotals(supabase as never, doc.id);
  } catch (e) {
    await supabase.from("purchase_documents").delete().eq("id", doc.id);
    return { success: false, error: e instanceof Error ? e.message : "Erreur insertion lignes." };
  }

  revalidatePath("/achats/commandes");
  redirect(`/achats/commandes/${doc.id}`);
}

export async function updateSupplierOrder(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const documentId = text(formData, "id");
  if (!documentId) return { success: false, error: "ID document manquant." };

  const { data: existing } = await supabase.from("purchase_documents").select("status").eq("id", documentId).eq("organization_id", orgId).single();
  if (!existing || existing.status !== "draft") return { success: false, error: "Seules les commandes brouillon peuvent etre modifiees." };

  const documentDate = text(formData, "document_date") ?? new Date().toISOString().slice(0, 10);
  const expectedReceiptDate = text(formData, "expected_receipt_date");
  const notes = text(formData, "notes");
  const internalNotes = text(formData, "internal_notes");

  const lines = parseJsonLines(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Ajoutez au moins une ligne." };

  const unitError = validateUnits(lines);
  if (unitError) return { success: false, error: unitError };

  await supabase.from("purchase_documents").update({ document_date: documentDate, expected_receipt_date: expectedReceiptDate, notes, internal_notes: internalNotes }).eq("id", documentId);
  await supabase.from("purchase_document_lines").delete().eq("document_id", documentId);

  try {
    await insertPurchaseLines(supabase as never, documentId, orgId, lines);
    await updatePurchaseTotals(supabase as never, documentId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur mise a jour lignes." };
  }

  revalidatePath("/achats/commandes");
  redirect(`/achats/commandes/${documentId}`);
}

export async function confirmSupplierOrder(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const { data: doc } = await supabase.from("purchase_documents").select("status").eq("id", id).eq("organization_id", workspace.organization.id).single();
  if (!doc) return { success: false, error: "Document introuvable." };
  if (doc.status !== "draft") return { success: false, error: "Seules les commandes brouillon peuvent etre confirmees." };

  const { error } = await supabase.from("purchase_documents").update({ status: "confirmed" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/achats/commandes");
  return { success: true };
}

export async function cancelSupplierOrder(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const { data: doc } = await supabase.from("purchase_documents").select("status").eq("id", id).eq("organization_id", workspace.organization.id).single();
  if (!doc) return { success: false, error: "Document introuvable." };
  if (doc.status === "cancelled") return { success: false, error: "Deja annule." };
  if (doc.status === "received") return { success: false, error: "Impossible d'annuler une commande entierement recue." };

  const { error } = await supabase.from("purchase_documents").update({ status: "cancelled" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/achats/commandes");
  return { success: true };
}

// ============================================================================
// Supplier Receipts
// ============================================================================
export async function createSupplierReceipt(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const orderId = text(formData, "order_id");
  if (!orderId) return { success: false, error: "Veuillez selectionner une commande source." };

  const { data: order } = await supabase.from("purchase_documents").select("supplier_id, document_number, status").eq("id", orderId).eq("organization_id", orgId).single();
  if (!order) return { success: false, error: "Commande introuvable." };
  if (!["confirmed", "partially_received"].includes(order.status)) return { success: false, error: "La commande n'est pas eligible a la reception." };

  const lines = parseJsonLines(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Ajoutez au moins une ligne." };

  const hasQuantity = lines.some((l) => numberValue(l.quantity) > 0);
  if (!hasQuantity) return { success: false, error: "Au moins une ligne doit avoir une quantite > 0." };

  // Verify quantities against real remaining from validated receipts
  const progress = await getSupplierOrderLineProgress(supabase as never, orgId, orderId);
  for (const line of lines) {
    const qty = numberValue(line.quantity);
    if (qty <= 0) continue;
    const sourceLineId = (line.source_line_id as string) || null;
    if (!sourceLineId) continue;
    const p = progress.get(sourceLineId);
    if (!p) return { success: false, error: `Ligne commande introuvable.` };
    if (qty > p.remaining) {
      const productName = (line.product_name as string) || "l'article";
      return { success: false, error: `Impossible de receptionner plus que le reste a recevoir pour ${productName}. Reste disponible : ${p.remaining}.` };
    }
    if (qty !== Math.floor(qty) && (line.unit_name as string)?.toLowerCase() === "u") {
      return { success: false, error: `La quantite de ${(line.product_name as string) || "l'article"} doit etre un entier (unite U).` };
    }
  }

  const receiptDate = text(formData, "receipt_date") ?? new Date().toISOString().slice(0, 10);
  const notes = text(formData, "notes");
  const internalNotes = text(formData, "internal_notes");
  const warehouseId = text(formData, "warehouse_id") ?? await getDefaultStockLocationId(orgId);
  const sourceLineIds = lines.map((line) => (line.source_line_id as string) || null).filter(Boolean) as string[];
  const { data: sourceLines } = sourceLineIds.length
    ? await supabase
        .from("purchase_document_lines")
        .select("id, product_id, product_name, description, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id, tax_rate")
        .eq("organization_id", orgId)
        .in("id", sourceLineIds)
    : { data: [] };
  const sourceLineById = new Map((sourceLines ?? []).map((line: Record<string, unknown>) => [String(line.id), line]));

  const { data: doc, error: docError } = await supabase
    .from("purchase_documents")
    .insert({ organization_id: orgId, document_type: "supplier_receipt", document_number: "", supplier_id: order.supplier_id, source_document_id: orderId, related_order_id: orderId, warehouse_id: warehouseId, document_date: receiptDate, receipt_date: receiptDate, notes, internal_notes: internalNotes, status: "draft" })
    .select("id, document_number")
    .single();
  if (docError) return { success: false, error: docError.message };
  if (!doc) return { success: false, error: "Erreur creation reception." };

  try {
    const calculated = lines
      .map((line, index) => {
        const quantity = numberValue(line.quantity);
        const sourceLineId = (line.source_line_id as string) || null;
        const sourceLine = sourceLineId ? sourceLineById.get(sourceLineId) : null;
        const orderedQty = numberValue(line.ordered_quantity ?? quantity);
        const receivedQty = numberValue(line.received_quantity ?? 0);
        const remainingQty = orderedQty - receivedQty - quantity;
        const unitPriceHt = numberValue(line.unit_price_ht ?? sourceLine?.unit_price_ht);
        const discountRate = numberValue(line.discount_rate ?? sourceLine?.discount_rate);
        const taxRate = numberValue(line.tax_rate ?? sourceLine?.tax_rate);
        const baseHt = quantity * unitPriceHt;
        const discountAmount = roundMoney(baseHt * (discountRate / 100));
        const subtotalHt = roundMoney(baseHt - discountAmount);
        const taxAmount = roundMoney(subtotalHt * (taxRate / 100));
        const totalTtc = roundMoney(subtotalHt + taxAmount);
        return {
          organization_id: orgId,
          document_id: doc.id,
          source_line_id: sourceLineId,
          line_order: index + 1,
          product_id: (line.product_id as string) || (sourceLine?.product_id as string) || null,
          product_name: (line.product_name as string) || (sourceLine?.product_name as string) || null,
          description: (line.description as string) || (sourceLine?.description as string) || "",
          quantity,
          unit_id: (line.unit_id as string) || (sourceLine?.unit_id as string) || null,
          unit_name: (line.unit_name as string) || (sourceLine?.unit_name as string) || null,
          unit_price_ht: unitPriceHt,
          discount_rate: discountRate,
          tax_rate_id: (line.tax_rate_id as string) || (sourceLine?.tax_rate_id as string) || null,
          tax_rate: taxRate,
          subtotal_ht: subtotalHt,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_ttc: totalTtc,
          ordered_quantity: orderedQty,
          received_quantity: quantity,
          remaining_quantity: Math.max(remainingQty, 0),
        };
      })
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

    if (calculated.length === 0) {
      await supabase.from("purchase_documents").delete().eq("id", doc.id);
      return { success: false, error: "Aucune quantite a receptionner. Saisissez au moins une quantite superieure a zero." };
    }

    // Re-assign line_order after filtering
    calculated.forEach((line, idx) => { line.line_order = idx + 1; });

    const { error: linesError } = await supabase.from("purchase_document_lines").insert(calculated);
    if (linesError) throw new Error(linesError.message);
  } catch (e) {
    await supabase.from("purchase_documents").delete().eq("id", doc.id);
    return { success: false, error: e instanceof Error ? e.message : "Erreur insertion lignes." };
  }

  revalidatePath("/achats/receptions");
  redirect(`/achats/receptions/${doc.id}`);
}

export async function validateSupplierReceipt(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const { data: doc } = await supabase.from("purchase_documents").select("id, document_type, status, stock_updated_at, supplier_id, related_order_id, warehouse_id").eq("id", id).eq("organization_id", orgId).single();
  if (!doc) return { success: false, error: "Document introuvable." };
  if (doc.document_type !== "supplier_receipt") return { success: false, error: "Ce n'est pas une reception." };
  if (doc.status !== "draft") return { success: false, error: "Seules les receptions brouillon peuvent etre validees." };
  if (doc.stock_updated_at) return { success: false, error: "Le stock a deja ete mis a jour pour cette reception." };

  const { data: lines } = await supabase.from("purchase_document_lines").select("id, product_id, quantity, unit_name, source_line_id").eq("document_id", id);
  if (!lines || lines.length === 0) return { success: false, error: "Aucune ligne a receptionner." };

  // Verify no line exceeds real remaining from validated receipts (exclude this draft)
  if (doc.related_order_id) {
    const progress = await getSupplierOrderLineProgress(supabase as never, orgId, doc.related_order_id, id);
    for (const line of lines) {
      if (!line.source_line_id) continue;
      const p = progress.get(line.source_line_id);
      if (!p) continue;
      const qty = Number(line.quantity);
      if (qty > p.remaining) {
        const productName = line.product_id ? (await supabase.from("products").select("name").eq("id", line.product_id).maybeSingle()).data?.name ?? "l'article" : "l'article";
        return { success: false, error: `Validation impossible : la quantite recue depasse la quantite commandee pour ${productName}. Reste disponible : ${p.remaining}.` };
      }
    }
  }

  const defaultWarehouse = doc.warehouse_id ?? await getDefaultStockLocationId(orgId);

  for (const line of lines) {
    if (!line.product_id) continue;
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: "Quantite de reception invalide." };
    }
    if (line.unit_name?.toLowerCase() === "u" && !Number.isInteger(quantity)) {
      return { success: false, error: `La quantite du produit ${line.product_id} doit etre un entier (unite U).` };
    }
    const { data: product } = await supabase.from("products").select("type, track_stock, current_stock").eq("id", line.product_id).single();
    if (product?.type === "product" && product.track_stock) {
      const currentStock = Number(product.current_stock ?? 0);
      const { error: stockError } = await supabase.from("products").update({ current_stock: currentStock + quantity }).eq("id", line.product_id);
      if (stockError) return { success: false, error: `Erreur mise a jour stock: ${stockError.message}` };

      const { error: moveError } = await supabase.from("stock_moves").insert({
        organization_id: orgId,
        warehouse_id: defaultWarehouse,
        product_id: line.product_id,
        source_document_id: id,
        source_line_id: line.source_line_id ?? line.id,
        move_type: "purchase_receipt_in",
        direction: "in",
        quantity,
        movement_date: new Date().toISOString(),
        notes: "Reception fournisseur",
        created_by: workspace.userId,
      });
      if (moveError) return { success: false, error: `Erreur creation mouvement stock: ${moveError.message}` };
    }
  }

  const { error: validateError } = await supabase.from("purchase_documents").update({ status: "validated", validated_at: new Date().toISOString(), stock_updated_at: new Date().toISOString() }).eq("id", id);
  if (validateError) return { success: false, error: validateError.message };

  if (doc.related_order_id) {
    await updateOrderStatusFromReceipts(supabase as never, doc.related_order_id);
  }

  revalidatePath("/achats/receptions");
  return { success: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateOrderStatusFromReceipts(supabase: any, orderId: string) {
  const { data: orderLines } = await supabase.from("purchase_document_lines").select("id, quantity").eq("document_id", orderId);
  if (!orderLines || orderLines.length === 0) return;
  const { data: receipts } = await supabase
    .from("purchase_documents")
    .select("id")
    .eq("related_order_id", orderId)
    .eq("document_type", "supplier_receipt")
    .eq("status", "validated")
    .is("archived_at", null);
  const receiptIds = (receipts ?? []).map((r: { id: string }) => r.id);
  const receivedMap = new Map<string, number>();
  if (receiptIds.length > 0) {
    const { data: receiptLines } = await supabase
      .from("purchase_document_lines")
      .select("source_line_id, quantity")
      .in("document_id", receiptIds)
      .not("source_line_id", "is", null);
    (receiptLines ?? []).forEach((l: { source_line_id: string; quantity: number }) => {
      const current = receivedMap.get(l.source_line_id) ?? 0;
      receivedMap.set(l.source_line_id, current + Number(l.quantity));
    });
  }
  let allReceived = true;
  let someReceived = false;
  for (const ol of orderLines) {
    const received = receivedMap.get(ol.id) ?? 0;
    if (received > 0) someReceived = true;
    if (received < Number(ol.quantity)) allReceived = false;
  }
  let newStatus: string;
  if (allReceived) newStatus = "received";
  else if (someReceived) newStatus = "partially_received";
  else newStatus = "confirmed";
  await supabase.from("purchase_documents").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
}

export async function cancelSupplierReceipt(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const { data: doc } = await supabase.from("purchase_documents").select("status").eq("id", id).eq("organization_id", workspace.organization.id).single();
  if (!doc) return { success: false, error: "Document introuvable." };
  if (doc.status !== "draft") return { success: false, error: "Seules les receptions brouillon peuvent etre annulees." };

  const { error } = await supabase.from("purchase_documents").update({ status: "cancelled" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/achats/receptions");
  return { success: true };
}

// ============================================================================
// Supplier Invoices
// ============================================================================
export async function createSupplierInvoice(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const supplierId = text(formData, "supplier_id");
  if (!supplierId) return { success: false, error: "Veuillez selectionner un fournisseur." };

  const invoiceDate = text(formData, "invoice_date") ?? new Date().toISOString().slice(0, 10);
  const dueDate = text(formData, "due_date");
  const supplierInvoiceNumber = text(formData, "supplier_invoice_number");
  if (!supplierInvoiceNumber) return { success: false, error: "Le numéro de facture fournisseur est obligatoire." };

  const { data: dup } = await supabase
    .from("supplier_invoices")
    .select("id")
    .eq("organization_id", orgId)
    .eq("supplier_id", supplierId)
    .eq("supplier_invoice_number", supplierInvoiceNumber)
    .not("status", "eq", "cancelled")
    .maybeSingle();
  if (dup) return { success: false, error: "Une facture avec ce numéro existe déjà pour ce fournisseur." };

  const notes = text(formData, "notes");
  const internalNotes = text(formData, "internal_notes");
  const sourceReceiptId = text(formData, "source_receipt_id");

  if (sourceReceiptId) {
    const { data: existingByReceipt } = await supabase
      .from("supplier_invoices")
      .select("id")
      .eq("organization_id", orgId)
      .eq("source_receipt_id", sourceReceiptId)
      .not("status", "eq", "cancelled")
      .maybeSingle();
    if (existingByReceipt) return { success: false, error: "Cette reception a deja ete facturee." };
  }

  let lines = parseJsonLines(formData, "lines");
  if (sourceReceiptId) {
    const preparation = await getSupplierInvoicePreparationFromReceipt(sourceReceiptId);
    if (!preparation) return { success: false, error: "Réception fournisseur introuvable." };
    if (preparation.receipt.status !== "validated") return { success: false, error: "Seule une réception validée peut être facturée." };
    if (preparation.receipt.supplier_id !== supplierId) return { success: false, error: "Le fournisseur ne correspond pas à la réception source." };
    if (preparation.lines.length === 0) return { success: false, error: "Cette réception est déjà totalement facturée ou ne contient aucune ligne facturable." };
    const submittedBySourceLine = new Map(lines.map((line) => [String(line.source_line_id ?? line.id ?? ""), line]));
    lines = preparation.lines.map((preparedLine) => {
      const submitted = submittedBySourceLine.get(String(preparedLine.source_line_id)) ?? {};
      return {
        ...preparedLine,
        description: (submitted.description as string) || preparedLine.description,
        quantity: numberValue(submitted.quantity ?? preparedLine.quantity) || preparedLine.quantity,
        unit_id: (submitted.unit_id as string) || preparedLine.unit_id || null,
        unit_name: (submitted.unit_name as string) || preparedLine.unit_name || null,
        unit_price_ht: numberValue(submitted.unit_price_ht ?? preparedLine.unit_price_ht),
        discount_rate: numberValue(submitted.discount_rate ?? preparedLine.discount_rate),
        tax_rate_id: (submitted.tax_rate_id as string) || preparedLine.tax_rate_id || null,
        tax_rate: numberValue(submitted.tax_rate ?? preparedLine.tax_rate),
        source_line_id: preparedLine.source_line_id,
        source_document_id: sourceReceiptId,
      };
    });
  }
  if (lines.length === 0) return { success: false, error: "Ajoutez au moins une ligne." };

  const unitError = validateUnits(lines);
  if (unitError) return { success: false, error: unitError };

  const { data: inv, error: invError } = await supabase
    .from("supplier_invoices")
    .insert({ organization_id: orgId, invoice_number: "", supplier_id: supplierId, supplier_invoice_number: supplierInvoiceNumber, source_type: sourceReceiptId ? "supplier_receipt" : "manual", source_receipt_id: sourceReceiptId, invoice_date: invoiceDate, due_date: dueDate, notes, internal_notes: internalNotes, status: "draft" })
    .select("id, invoice_number")
    .single();
  if (invError) return { success: false, error: invError.message };
  if (!inv) return { success: false, error: "Erreur creation facture." };

  try {
    const calculated = lines.map((line, index) => {
      const calc = calculatePurchaseLine(line);
      return {
        organization_id: orgId,
        invoice_id: inv.id,
        source_line_id: (calc.source_line_id as string) || null,
        source_document_id: (calc.source_document_id as string) || null,
        line_order: index + 1,
        product_id: (calc.product_id as string) || null,
        product_name: (calc.product_name as string) || null,
        description: (calc.description as string) || "",
        quantity: calc.quantity as number,
        unit_id: (calc.unit_id as string) || null,
        unit_name: (calc.unit_name as string) || null,
        unit_price_ht: calc.unit_price_ht as number,
        discount_rate: calc.discount_rate as number,
        tax_rate_id: (calc.tax_rate_id as string) || null,
        tax_rate: calc.tax_rate as number,
        subtotal_ht: calc.subtotal_ht as number,
        discount_amount: calc.discount_amount as number,
        tax_amount: calc.tax_amount as number,
        total_ttc: calc.total_ttc as number,
      };
    });
    const { error: linesError } = await supabase.from("supplier_invoice_lines").insert(calculated);
    if (linesError) throw new Error(linesError.message);

    const subtotalHt = calculated.reduce((s, l) => s + l.subtotal_ht, 0);
    const discountTotal = calculated.reduce((s, l) => s + l.discount_amount, 0);
    const taxTotal = calculated.reduce((s, l) => s + l.tax_amount, 0);
    const totalTtc = calculated.reduce((s, l) => s + l.total_ttc, 0);
    await supabase.from("supplier_invoices").update({ subtotal_ht: subtotalHt, discount_total: discountTotal, tax_total: taxTotal, total_ttc: totalTtc }).eq("id", inv.id);
  } catch (e) {
    await supabase.from("supplier_invoices").delete().eq("id", inv.id);
    return { success: false, error: e instanceof Error ? e.message : "Erreur insertion lignes." };
  }

  revalidatePath("/achats/factures");
  redirect(`/achats/factures/${inv.id}`);
}

export async function updateSupplierInvoice(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const invoiceId = text(formData, "id");
  if (!invoiceId) return { success: false, error: "ID facture manquant." };

  const { data: existing } = await supabase.from("supplier_invoices").select("status").eq("id", invoiceId).eq("organization_id", orgId).single();
  if (!existing || existing.status !== "draft") return { success: false, error: "Seules les factures brouillon peuvent etre modifiees." };

  const invoiceDate = text(formData, "invoice_date") ?? new Date().toISOString().slice(0, 10);
  const dueDate = text(formData, "due_date");
  const supplierInvoiceNumber = text(formData, "supplier_invoice_number");
  if (!supplierInvoiceNumber) return { success: false, error: "Le numéro de facture fournisseur est obligatoire." };

  const { data: existingInv } = await supabase.from("supplier_invoices").select("supplier_id").eq("id", invoiceId).eq("organization_id", orgId).single();
  const invSupplierId = existingInv?.supplier_id;
  if (invSupplierId) {
    const { data: dup } = await supabase
      .from("supplier_invoices")
      .select("id")
      .eq("organization_id", orgId)
      .eq("supplier_id", invSupplierId)
      .eq("supplier_invoice_number", supplierInvoiceNumber)
      .not("status", "eq", "cancelled")
      .neq("id", invoiceId)
      .maybeSingle();
    if (dup) return { success: false, error: "Une facture avec ce numéro existe déjà pour ce fournisseur." };
  }

  const notes = text(formData, "notes");
  const internalNotes = text(formData, "internal_notes");

  const lines = parseJsonLines(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Ajoutez au moins une ligne." };
  const unitError = validateUnits(lines);
  if (unitError) return { success: false, error: unitError };

  await supabase.from("supplier_invoices").update({ invoice_date: invoiceDate, due_date: dueDate, supplier_invoice_number: supplierInvoiceNumber, notes, internal_notes: internalNotes }).eq("id", invoiceId);
  await supabase.from("supplier_invoice_lines").delete().eq("invoice_id", invoiceId);

  try {
    const calculated = lines.map((line, index) => {
      const calc = calculatePurchaseLine(line);
      return {
        organization_id: orgId,
        invoice_id: invoiceId,
        source_line_id: (calc.source_line_id as string) || null,
        source_document_id: (calc.source_document_id as string) || null,
        line_order: index + 1,
        product_id: (calc.product_id as string) || null,
        product_name: (calc.product_name as string) || null,
        description: (calc.description as string) || "",
        quantity: calc.quantity as number,
        unit_id: (calc.unit_id as string) || null,
        unit_name: (calc.unit_name as string) || null,
        unit_price_ht: calc.unit_price_ht as number,
        discount_rate: calc.discount_rate as number,
        tax_rate_id: (calc.tax_rate_id as string) || null,
        tax_rate: calc.tax_rate as number,
        subtotal_ht: calc.subtotal_ht as number,
        discount_amount: calc.discount_amount as number,
        tax_amount: calc.tax_amount as number,
        total_ttc: calc.total_ttc as number,
      };
    });
    const { error: linesError } = await supabase.from("supplier_invoice_lines").insert(calculated);
    if (linesError) throw new Error(linesError.message);
    const subtotalHt = calculated.reduce((s, l) => s + l.subtotal_ht, 0);
    const discountTotal = calculated.reduce((s, l) => s + l.discount_amount, 0);
    const taxTotal = calculated.reduce((s, l) => s + l.tax_amount, 0);
    const totalTtc = calculated.reduce((s, l) => s + l.total_ttc, 0);
    await supabase.from("supplier_invoices").update({ subtotal_ht: subtotalHt, discount_total: discountTotal, tax_total: taxTotal, total_ttc: totalTtc }).eq("id", invoiceId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur mise a jour lignes." };
  }

  revalidatePath("/achats/factures");
  redirect(`/achats/factures/${invoiceId}`);
}

export async function validateSupplierInvoice(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const { data: inv, error: invoiceError } = await supabase
    .from("supplier_invoices")
    .select("id, status, supplier_id, total_ttc, paid_amount, archived_at, supplier_invoice_number")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (invoiceError) return { success: false, error: invoiceError.message };
  if (!inv) return { success: false, error: "Facture introuvable." };
  if (inv.archived_at) return { success: false, error: "Impossible de valider une facture archivee." };
  if (inv.status !== "draft") return { success: false, error: "Seules les factures brouillon peuvent etre validees." };
  if (!inv.supplier_id) return { success: false, error: "Fournisseur obligatoire pour valider la facture." };
  if (!inv.supplier_invoice_number || !inv.supplier_invoice_number.trim()) return { success: false, error: "Le numéro de facture fournisseur est obligatoire avant validation." };

  const { data: supplier, error: supplierError } = await supabase
    .from("third_parties")
    .select("id")
    .eq("id", inv.supplier_id)
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .maybeSingle();
  if (supplierError) return { success: false, error: supplierError.message };
  if (!supplier) return { success: false, error: "Fournisseur introuvable ou archive." };

  const { data: lines, error: linesError } = await supabase
    .from("supplier_invoice_lines")
    .select("quantity, unit_id, unit_name, unit_price_ht, tax_rate_id, tax_rate, subtotal_ht, discount_amount, tax_amount, total_ttc")
    .eq("invoice_id", id)
    .eq("organization_id", orgId);
  if (linesError) return { success: false, error: linesError.message };
  if (!lines || lines.length === 0) return { success: false, error: "Impossible de valider une facture sans ligne." };
  const hasIncompleteLine = lines.some((line) =>
    Number(line.quantity ?? 0) <= 0 ||
    (!line.unit_id && !line.unit_name) ||
    Number(line.unit_price_ht ?? 0) <= 0 ||
    (!line.tax_rate_id && line.tax_rate === null) ||
    !Number.isFinite(Number(line.subtotal_ht)) ||
    !Number.isFinite(Number(line.total_ttc))
  );
  if (hasIncompleteLine) return { success: false, error: "Certaines lignes de facture sont incomplètes : unité, prix HT ou TVA manquant." };

  const subtotalHt = lines.reduce((sum, line) => sum + Number(line.subtotal_ht ?? 0), 0);
  const discountTotal = lines.reduce((sum, line) => sum + Number(line.discount_amount ?? 0), 0);
  const taxTotal = lines.reduce((sum, line) => sum + Number(line.tax_amount ?? 0), 0);
  const totalTtc = lines.reduce((sum, line) => sum + Number(line.total_ttc ?? 0), 0);
  if (totalTtc <= 0) return { success: false, error: "Total facture invalide." };

  const paidAmount = Math.max(Number(inv.paid_amount ?? 0), 0);
  const remainingAmount = Math.max(totalTtc - paidAmount, 0);
  const paymentStatus = paidAmount <= 0 ? "unpaid" : paidAmount >= totalTtc ? "paid" : "partial";
  const nextStatus = paymentStatus === "paid" ? "paid" : paymentStatus === "partial" ? "partially_paid" : "validated";

  const { error: updateError } = await supabase
    .from("supplier_invoices")
    .update({
      status: nextStatus,
      validated_at: new Date().toISOString(),
      payment_status: paymentStatus,
      subtotal_ht: subtotalHt,
      discount_total: discountTotal,
      tax_total: taxTotal,
      total_ttc: totalTtc,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", orgId);
  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/achats/factures");
  revalidatePath(`/achats/factures/${id}`);
  revalidatePath("/achats/paiements/new");
  return { success: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSupplierInvoiceDangerousActionBlockReason(supabase: any, orgId: string, invoiceId: string) {
  const { data: invoice, error: invoiceError } = await supabase
    .from("supplier_invoices")
    .select("id, status, payment_status, paid_amount, source_type, source_receipt_id")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (invoiceError) return invoiceError.message;
  if (!invoice) return "Facture introuvable.";
  if (invoice.status === "cancelled") return "Deja annulee.";

  const { data: lines } = await supabase
    .from("supplier_invoice_lines")
    .select("source_document_id, source_line_id")
    .eq("invoice_id", invoiceId)
    .eq("organization_id", orgId);

  if (isSupplierInvoiceFromReceipt(invoice, lines ?? [])) {
    return "Cette facture fournisseur est issue d’une réception. Elle ne peut pas être annulée directement.";
  }

  const summary = await getSupplierInvoicePaymentSummary({ organizationId: orgId, supplierInvoiceId: invoiceId });
  if (summary && Number(summary.paidAmount ?? 0) > 0.01) {
    return "Cette facture fournisseur est comptabilisée ou payée. Utilisez un avoir fournisseur ou une écriture de correction selon le cas.";
  }

  const { data: accountingEntries, error: accountingError } = await supabase
    .from("accounting_entries")
    .select("id")
    .eq("organization_id", orgId)
    .eq("source_document_type", "supplier_invoice")
    .eq("source_document_id", invoiceId)
    .not("status", "in", "(cancelled,canceled,void,archived)")
    .is("archived_at", null)
    .limit(1);

  if (accountingError) return accountingError.message;
  if ((accountingEntries ?? []).length > 0) {
    return "Cette facture fournisseur est comptabilisée ou payée. Utilisez un avoir fournisseur ou une écriture de correction selon le cas.";
  }

  return null;
}

export async function cancelSupplierInvoice(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const blockReason = await getSupplierInvoiceDangerousActionBlockReason(supabase, workspace.organization.id, id);
  if (blockReason) return { success: false, error: blockReason };

  await supabase.from("supplier_invoices").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/achats/factures");
  return { success: true };
}

export async function archiveSupplierInvoice(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const blockReason = await getSupplierInvoiceDangerousActionBlockReason(supabase, workspace.organization.id, id);
  if (blockReason) {
    if (blockReason.includes("annulée")) {
      return { success: false, error: "Cette facture fournisseur est issue d’une réception. Elle ne peut pas être archivée directement." };
    }
    return { success: false, error: blockReason };
  }

  const { error } = await supabase
    .from("supplier_invoices")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", workspace.organization.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/achats/factures");
  revalidatePath(`/achats/factures/${id}`);
  return { success: true };
}

export async function recalculateSupplierInvoicePaymentStatusAction(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const invoiceId = text(formData, "id") ?? text(formData, "supplier_invoice_id");
  if (!invoiceId) return { success: false, error: "ID facture fournisseur manquant." };

  await recalcSupplierInvoicePaymentStatus(supabase as never, invoiceId, orgId);

  revalidatePath("/achats/factures");
  revalidatePath(`/achats/factures/${invoiceId}`);
  revalidatePath("/achats/paiements");
  return { success: true };
}

// ============================================================================
// Supplier Payments
// ============================================================================
async function validateSupplierInvoiceAllocations({
  supabase,
  orgId,
  supplierId,
  allocations,
  paymentAmount,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  orgId: string;
  supplierId: string;
  allocations: Record<string, unknown>[];
  paymentAmount?: number;
}): Promise<{ success: true; totalAllocated: number } | { success: false; error: string }> {
  const totalsByInvoice = new Map<string, number>();
  for (const allocation of allocations) {
    const invoiceId = allocation.invoice_id as string;
    const amount = numberValue(allocation.amount);
    if (!invoiceId || amount <= 0) continue;
    totalsByInvoice.set(invoiceId, (totalsByInvoice.get(invoiceId) ?? 0) + amount);
  }

  const totalAllocated = Array.from(totalsByInvoice.values()).reduce((sum, amount) => sum + amount, 0);
  if (paymentAmount !== undefined && totalAllocated > 0 && paymentAmount > totalAllocated + 0.01) {
    return { success: false, error: "Le montant du paiement dépasse le reste à payer de la facture." };
  }
  if (paymentAmount !== undefined && totalAllocated > paymentAmount + 0.01) {
    return { success: false, error: "Le montant total des affectations dépasse le montant du paiement." };
  }

  for (const [invoiceId, allocatedAmount] of totalsByInvoice.entries()) {
    const { data: invoice } = await supabase
      .from("supplier_invoices")
      .select("id, supplier_id, invoice_number, supplier_invoice_number")
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .single();

    if (!invoice) return { success: false, error: "Facture fournisseur introuvable." };
    if (invoice.supplier_id !== supplierId) return { success: false, error: "La facture sélectionnée ne correspond pas au fournisseur du paiement." };

    const summary = await getSupplierInvoicePaymentSummary({ organizationId: orgId, supplierInvoiceId: invoiceId });
    if (!summary) return { success: false, error: "Impossible de vérifier le solde de la facture fournisseur." };
    if (!summary.canRegisterPayment) {
      return { success: false, error: "Cette facture fournisseur est déjà totalement payée. Aucun paiement supplémentaire n’est autorisé." };
    }
    if (allocatedAmount > (summary.maxPaymentAmount ?? 0) + 0.01) {
      return { success: false, error: "Le montant du paiement dépasse le reste à payer de la facture." };
    }
  }

  return { success: true, totalAllocated };
}

export async function createSupplierPayment(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const supplierId = text(formData, "supplier_id");
  if (!supplierId) return { success: false, error: "Veuillez selectionner un fournisseur." };

  const amount = numberOrZero(formData, "amount");
  if (amount <= 0) return { success: false, error: "Le montant doit etre superieur a 0." };

  const paymentDate = text(formData, "payment_date") ?? new Date().toISOString().slice(0, 10);
  const valueDate = text(formData, "value_date");
  const paymentMethod = text(formData, "payment_method");
  const reference = text(formData, "reference");
  const bankName = text(formData, "bank_name");
  const checkNumber = text(formData, "check_number");
  const transferReference = text(formData, "transfer_reference");
  const dueDate = text(formData, "due_date");
  const notes = text(formData, "notes");
  const treasuryAccountId = text(formData, "treasury_account_id");
  if (!treasuryAccountId) return { success: false, error: "Selectionnez un compte de decaissement." };

  const invoiceContextId = text(formData, "supplier_invoice_id") ?? text(formData, "invoice_id");
  const allocations = parseJsonLines(formData, "allocations");
  if (invoiceContextId && !allocations.some((allocation) => allocation.invoice_id === invoiceContextId)) {
    allocations.push({ invoice_id: invoiceContextId, amount });
  }
  const allocationValidation = await validateSupplierInvoiceAllocations({ supabase, orgId, supplierId, allocations, paymentAmount: amount });
  if (!allocationValidation.success) return allocationValidation;

  const { data: payment, error: payError } = await supabase
    .from("supplier_payments")
    .insert({ organization_id: orgId, payment_number: "", supplier_id: supplierId, treasury_account_id: treasuryAccountId, amount, payment_date: paymentDate, value_date: valueDate, payment_method: paymentMethod, reference: reference, bank_name: bankName, check_number: checkNumber, transfer_reference: transferReference, due_date: dueDate, notes, status: "confirmed", allocated_amount: 0, available_amount: amount })
    .select("id, payment_number")
    .single();
  if (payError) return { success: false, error: payError.message };
  if (!payment) return { success: false, error: "Erreur creation paiement." };

  let totalAllocated = 0;
  for (const alloc of allocations) {
    const invoiceId = alloc.invoice_id as string;
    const allocAmount = numberValue(alloc.amount);
    if (!invoiceId || allocAmount <= 0) continue;
    totalAllocated += allocAmount;
    const { error: allocError } = await supabase.from("supplier_payment_allocations").insert({ organization_id: orgId, payment_id: payment.id, invoice_id: invoiceId, supplier_id: supplierId, amount: allocAmount, created_by: workspace.userId });
    if (allocError) return { success: false, error: `Erreur affectation: ${allocError.message}` };
    await recalcSupplierInvoicePaymentStatus(supabase as never, invoiceId, orgId);
  }

  if (totalAllocated > 0) {
    await supabase.from("supplier_payments").update({ allocated_amount: totalAllocated, available_amount: amount - totalAllocated, status: totalAllocated >= amount ? "allocated" : "partially_allocated" }).eq("id", payment.id);
  }

  const treasuryResult = await createTreasuryTransactionFromPayment({
    organizationId: orgId,
    userId: workspace.userId,
    treasuryAccountId,
    direction: "out",
    amount,
    transactionDate: paymentDate,
    valueDate,
    label: `Paiement fournisseur ${payment.payment_number || ""}`.trim(),
    reference: reference ?? transferReference,
    thirdPartyId: supplierId,
    supplierPaymentId: payment.id,
  });
  if (treasuryResult.error) return { success: false, error: treasuryResult.error };

  revalidatePath("/achats/paiements");
  redirect(`/achats/paiements/${payment.id}`);
}

export async function allocateSupplierPaymentToInvoices(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;

  const paymentId = text(formData, "id");
  if (!paymentId) return { success: false, error: "ID paiement manquant." };

  const { data: payment } = await supabase.from("supplier_payments").select("id, supplier_id, amount, allocated_amount, available_amount, status").eq("id", paymentId).eq("organization_id", orgId).single();
  if (!payment) return { success: false, error: "Paiement introuvable." };
  if (payment.available_amount <= 0) return { success: false, error: "Aucun montant disponible a affecter." };

  const allocations = parseJsonLines(formData, "allocations");
  const allocationValidation = await validateSupplierInvoiceAllocations({ supabase, orgId, supplierId: payment.supplier_id, allocations });
  if (!allocationValidation.success) return allocationValidation;

  let totalAllocated = 0;
  for (const alloc of allocations) {
    const invoiceId = alloc.invoice_id as string;
    const allocAmount = numberValue(alloc.amount);
    if (!invoiceId || allocAmount <= 0) continue;
    if (allocAmount > payment.available_amount - totalAllocated) return { success: false, error: "Le montant total des affectations depasse le montant disponible." };
    totalAllocated += allocAmount;
    const { error: allocError } = await supabase.from("supplier_payment_allocations").insert({ organization_id: orgId, payment_id: paymentId, invoice_id: invoiceId, supplier_id: payment.supplier_id, amount: allocAmount, created_by: workspace.userId });
    if (allocError) return { success: false, error: `Erreur affectation: ${allocError.message}` };
    await recalcSupplierInvoicePaymentStatus(supabase as never, invoiceId, orgId);
  }

  if (totalAllocated > 0) {
    const newAllocated = payment.allocated_amount + totalAllocated;
    const newAvailable = payment.amount - newAllocated;
    const newStatus = newAllocated >= payment.amount ? "allocated" : "partially_allocated";
    await supabase.from("supplier_payments").update({ allocated_amount: newAllocated, available_amount: Math.max(newAvailable, 0), status: newStatus }).eq("id", paymentId);
  }

  revalidatePath("/achats/paiements");
  redirect(`/achats/paiements/${paymentId}`);
}

export async function cancelSupplierPayment(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const { data: pay } = await supabase.from("supplier_payments").select("status, allocated_amount").eq("id", id).eq("organization_id", workspace.organization.id).single();
  if (!pay) return { success: false, error: "Paiement introuvable." };
  if (pay.status === "cancelled") return { success: false, error: "Deja annule." };

  const { data: allocations } = await supabase.from("supplier_payment_allocations").select("invoice_id, amount").eq("payment_id", id).is("cancelled_at", null);
  for (const alloc of allocations ?? []) {
    await supabase.from("supplier_payment_allocations").update({ cancelled_at: new Date().toISOString() }).eq("payment_id", id).eq("invoice_id", alloc.invoice_id);
    await recalcSupplierInvoicePaymentStatus(supabase as never, alloc.invoice_id, workspace.organization.id);
  }

  await supabase.from("supplier_payments").update({ status: "cancelled", allocated_amount: 0, available_amount: 0 }).eq("id", id);
  revalidatePath("/achats/paiements");
  return { success: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalcSupplierInvoicePaymentStatus(supabase: any, invoiceId: string, orgId: string) {
  const { data: invoice } = await supabase.from("supplier_invoices").select("status").eq("id", invoiceId).eq("organization_id", orgId).single();
  if (!invoice) return;
  const summary = await getSupplierInvoicePaymentSummary({ organizationId: orgId, supplierInvoiceId: invoiceId });
  if (!summary) return;
  const paidAmount = summary.paidAmount;
  const remainingAmount = summary.remainingAmount;
  const paymentStatus = summary.paymentStatus === "partial" ? "partial" : summary.paymentStatus === "overpaid" ? "paid" : summary.paymentStatus;
  let status = invoice.status;
  if (paymentStatus === "paid") status = "paid";
  else if (paymentStatus === "partial" && ["validated", "paid"].includes(invoice.status)) status = "partially_paid";
  else if (paymentStatus === "unpaid" && ["paid", "partially_paid"].includes(invoice.status)) status = "validated";
  await supabase.from("supplier_invoices").update({ paid_amount: paidAmount, remaining_amount: remainingAmount, payment_status: paymentStatus, status }).eq("id", invoiceId);
}

// ============================================================================
// Archive
// ============================================================================
export async function archivePurchaseDocument(prev: PurchaseActionResult, formData: FormData): Promise<PurchaseActionResult> {
  void prev;
  const supabase = await createClient();
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const docType = text(formData, "document_type");
  if (!id) return { success: false, error: "ID manquant." };

  const { data: doc, error: docError } = await supabase
    .from("purchase_documents")
    .select("id, document_type")
    .eq("id", id)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  if (docError) return { success: false, error: docError.message };
  if (!doc) return { success: false, error: "Document introuvable." };

  if (doc.document_type === "supplier_receipt") {
    const eligibility = await getPurchaseReceiptArchiveEligibility(id);
    if (!eligibility.canArchive) {
      return { success: false, error: "Cette réception fournisseur ne peut pas être archivée, car elle est validée, facturée ou liée au stock." };
    }
  }

  const { error } = await supabase.from("purchase_documents").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("organization_id", workspace.organization.id);
  if (error) return { success: false, error: error.message };
  if ((docType ?? doc.document_type) === "supplier_order") revalidatePath("/achats/commandes");
  else revalidatePath("/achats/receptions");
  return { success: true };
}
