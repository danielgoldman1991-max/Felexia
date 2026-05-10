"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateSalesLine, calculateSalesTotals, isIndivisibleUnit } from "@/lib/sales-calculations";
import type { SalesActionResult, SalesDocumentType, SalesLineFormValue } from "@/lib/sales-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLines(formData: FormData): Record<string, unknown>[] {
  try {
    const raw = String(formData.get("lines") ?? "[]");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
  } catch {
    return [];
  }
}

function parseQuantityLines(formData: FormData): { source_line_id: string; quantity: number }[] {
  try {
    const raw = String(formData.get("lines") ?? "[]");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((line) => {
        const row = line as Record<string, unknown>;
        return {
          source_line_id: typeof row.source_line_id === "string" ? row.source_line_id : "",
          quantity: numberFromUnknown(row.quantity),
        };
      })
      .filter((line) => line.source_line_id && line.quantity > 0);
  } catch {
    return [];
  }
}

function normalizeLines(rawLines: Record<string, unknown>[]): { lines: SalesLineFormValue[]; error?: string } {
  if (rawLines.length === 0) {
    return { lines: [], error: "Ajoutez au moins une ligne au devis." };
  }

  const lines: SalesLineFormValue[] = [];

  for (const [index, rawLine] of rawLines.entries()) {
    const line = calculateSalesLine({
      id: typeof rawLine.id === "string" && rawLine.id ? rawLine.id : `line-${index + 1}`,
      mode: rawLine.mode === "free" ? "free" : "product",
      product_id: typeof rawLine.product_id === "string" ? rawLine.product_id : "",
      product_name: typeof rawLine.product_name === "string" ? rawLine.product_name : "",
      description: typeof rawLine.description === "string" ? rawLine.description.trim() : "",
      quantity: numberFromUnknown(rawLine.quantity),
      unit_id: typeof rawLine.unit_id === "string" ? rawLine.unit_id : "",
      unit_name: typeof rawLine.unit_name === "string" ? rawLine.unit_name : "",
      unit_price_ht: numberFromUnknown(rawLine.unit_price_ht),
      discount_rate: numberFromUnknown(rawLine.discount_rate),
      tax_rate_id: typeof rawLine.tax_rate_id === "string" ? rawLine.tax_rate_id : "",
      tax_rate: numberFromUnknown(rawLine.tax_rate),
      subtotal_ht: numberFromUnknown(rawLine.subtotal_ht),
      tax_amount: numberFromUnknown(rawLine.tax_amount),
      total_ttc: numberFromUnknown(rawLine.total_ttc),
    });

    if (!line.description.trim()) {
      return { lines: [], error: `La description de la ligne ${index + 1} est obligatoire.` };
    }
    if (line.quantity <= 0) {
      return { lines: [], error: "Les quantites doivent etre superieures a zero." };
    }
    if (line.unit_price_ht < 0) {
      return { lines: [], error: "Le prix ne peut pas etre negatif." };
    }
    if (line.discount_rate < 0 || line.discount_rate > 100) {
      return { lines: [], error: "La remise doit etre comprise entre 0 et 100%." };
    }

    lines.push(line);
  }

  return { lines };
}

async function validateIndivisibleLineQuantities(organizationId: string, lines: SalesLineFormValue[]) {
  const unitIds = Array.from(new Set(lines.map((line) => line.unit_id).filter(Boolean)));
  const supabase = await createClient();
  let units: { id: string; name: string | null; symbol: string | null }[] = [];

  if (unitIds.length > 0) {
    const { data, error } = await supabase
      .from("units")
      .select("id, name, symbol")
      .eq("organization_id", organizationId)
      .in("id", unitIds);

    if (error) return { error: "Impossible de verifier les unites des lignes." };
    units = data ?? [];
  }

  const hasInvalidQuantity = lines.some(
    (line) => isIndivisibleUnit(line, units) && !Number.isInteger(Number(line.quantity)),
  );

  if (hasInvalidQuantity) {
    return { error: "La quantite doit etre un nombre entier pour les articles en unite U." };
  }

  return {};
}

async function insertLines(documentId: string, organizationId: string, lines: SalesLineFormValue[]) {
  const supabase = await createClient();
  const payload = lines.map((line, index) => ({
    organization_id: organizationId,
    document_id: documentId,
    line_order: index + 1,
    product_id: line.product_id || null,
    product_name: line.product_name || null,
    description: line.description,
    quantity: line.quantity,
    unit_id: line.unit_id || null,
    unit_name: line.unit_name || null,
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id || null,
    tax_rate: line.tax_rate,
    subtotal_ht: line.subtotal_ht,
    tax_amount: line.tax_amount,
    total_ttc: line.total_ttc,
  }));

  return supabase.from("sales_document_lines").insert(payload);
}

async function copyLinesToDocument(sourceDocumentId: string, targetDocumentId: string, organizationId: string) {
  const supabase = await createClient();
  const { data: lines, error } = await supabase
    .from("sales_document_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", sourceDocumentId)
    .order("line_order", { ascending: true });

  if (error) return { error };
  if (!lines || lines.length === 0) return { error: { message: "Le document source ne contient aucune ligne." } };

  const payload = lines.map((line) => ({
    organization_id: organizationId,
    document_id: targetDocumentId,
    line_order: line.line_order,
    product_id: line.product_id,
    product_name: line.product_name,
    description: line.description,
    quantity: line.quantity,
    unit_id: line.unit_id,
    unit_name: line.unit_name,
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id,
    tax_rate: line.tax_rate,
    subtotal_ht: line.subtotal_ht,
    tax_amount: line.tax_amount,
    total_ttc: line.total_ttc,
  }));

  return supabase.from("sales_document_lines").insert(payload);
}

function lineToPayload(
  documentId: string,
  organizationId: string,
  line: SalesLineFormValue & {
    source_line_id?: string | null;
    ordered_quantity?: number | null;
    delivered_quantity?: number;
    returned_quantity?: number;
    remaining_quantity?: number | null;
  },
  index: number,
) {
  return {
    organization_id: organizationId,
    document_id: documentId,
    line_order: index + 1,
    source_line_id: line.source_line_id ?? null,
    product_id: line.product_id || null,
    product_name: line.product_name || null,
    description: line.description,
    quantity: line.quantity,
    ordered_quantity: line.ordered_quantity ?? null,
    delivered_quantity: line.delivered_quantity ?? 0,
    returned_quantity: line.returned_quantity ?? 0,
    remaining_quantity: line.remaining_quantity ?? null,
    unit_id: line.unit_id || null,
    unit_name: line.unit_name || null,
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id || null,
    tax_rate: line.tax_rate,
    subtotal_ht: line.subtotal_ht,
    tax_amount: line.tax_amount,
    total_ttc: line.total_ttc,
  };
}

async function getValidatedDeliveredQuantityBySourceLine(
  organizationId: string,
  sourceLineIds: string[],
  documentType: "delivery_note" | "return_note",
) {
  if (sourceLineIds.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_document_lines")
    .select("source_line_id, quantity, document:sales_documents!inner(document_type, status, organization_id)")
    .eq("organization_id", organizationId)
    .in("source_line_id", sourceLineIds)
    .eq("document.document_type", documentType)
    .in("document.status", documentType === "delivery_note" ? ["validated", "delivered"] : ["validated"]);

  if (error) return { error: error.message };

  const quantities = ((data ?? []) as { source_line_id: string | null; quantity: number }[]).reduce<Record<string, number>>(
    (acc, line) => {
      if (!line.source_line_id) return acc;
      acc[line.source_line_id] = (acc[line.source_line_id] ?? 0) + Number(line.quantity ?? 0);
      return acc;
    },
    {},
  );

  return { quantities };
}

async function updateOrderDeliveryStatus(organizationId: string, orderId: string) {
  const supabase = await createClient();
  const { data: orderLines, error } = await supabase
    .from("sales_document_lines")
    .select("id, quantity")
    .eq("organization_id", organizationId)
    .eq("document_id", orderId);

  if (error || !orderLines) return;

  const sourceLineIds = orderLines.map((line) => line.id as string);
  const deliveredResult = await getValidatedDeliveredQuantityBySourceLine(organizationId, sourceLineIds, "delivery_note");
  if ("error" in deliveredResult) return;

  const quantities = deliveredResult.quantities ?? {};
  const totalOrdered = orderLines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
  const totalDelivered = orderLines.reduce((sum, line) => sum + Math.min(Number(line.quantity ?? 0), quantities[line.id as string] ?? 0), 0);
  const nextStatus = totalDelivered <= 0
    ? "confirmed"
    : totalDelivered >= totalOrdered
      ? "delivered"
      : "partially_delivered";

  await supabase
    .from("sales_documents")
    .update({ status: nextStatus })
    .eq("organization_id", organizationId)
    .eq("id", orderId);
}

async function convertProspectToCustomerAfterOrderConfirmation(
  organizationId: string,
  userId: string,
  orderId: string,
) {
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("sales_documents")
    .select("id, document_number, customer_id, document_type, status")
    .eq("organization_id", organizationId)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order || order.document_type !== "order" || order.status !== "confirmed") return;

  const { data: thirdParty, error: thirdPartyError } = await supabase
    .from("third_parties")
    .select("id, types")
    .eq("organization_id", organizationId)
    .eq("id", order.customer_id)
    .maybeSingle();

  if (thirdPartyError || !thirdParty) return;

  const currentTypes = Array.isArray(thirdParty.types) ? thirdParty.types as string[] : [];
  if (!currentTypes.includes("prospect")) return;

  const nextTypes = Array.from(new Set(currentTypes.filter((type) => type !== "prospect").concat("customer")));
  const { error: updateError } = await supabase
    .from("third_parties")
    .update({
      types: nextTypes,
      primary_type: "customer",
      prospect_status: "gagne",
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", thirdParty.id);

  if (updateError) return;

  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: userId,
    table_name: "third_parties",
    record_id: thirdParty.id,
    action: "convert_prospect_to_customer",
    changes: {
      message: `Prospect converti automatiquement en client apres confirmation de la commande ${order.document_number}.`,
      order_id: order.id,
      order_number: order.document_number,
      previous_types: currentTypes,
      next_types: nextTypes,
    },
  });
}

async function getDefaultWarehouseId(organizationId: string) {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("warehouses")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (existing?.id) return { warehouseId: existing.id as string };

  const { data: created, error: createError } = await supabase
    .from("warehouses")
    .insert({
      organization_id: organizationId,
      name: "Dépôt principal",
      code: "MAIN",
      status: "active",
    })
    .select("id")
    .single();

  if (createError) {
    const { data: retry, error: retryError } = await supabase
      .from("warehouses")
      .select("id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (retryError || !retry?.id) {
      return { error: createError.message };
    }

    return { warehouseId: retry.id as string };
  }

  return { warehouseId: created.id as string };
}

async function applyStockMovesForDocument(
  organizationId: string,
  documentId: string,
  moveType: "delivery_out" | "customer_return_in",
  direction: "out" | "in",
  userId: string,
) {
  const supabase = await createClient();
  const { data: lines, error: lineError } = await supabase
    .from("sales_document_lines")
    .select("id, product_id, quantity")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId);

  if (lineError) return { error: lineError.message };
  const productIds = Array.from(new Set((lines ?? []).map((line) => line.product_id).filter(Boolean))) as string[];
  if (productIds.length === 0) return {};
  const warehouseResult = await getDefaultWarehouseId(organizationId);
  if (warehouseResult.error || !warehouseResult.warehouseId) {
    return { error: warehouseResult.error ?? "Impossible de determiner le depot principal." };
  }

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, type, sku, name, track_stock, current_stock")
    .eq("organization_id", organizationId)
    .in("id", productIds);

  if (productError) return { error: productError.message };
  const productsById = new Map((products ?? []).map((product) => [product.id as string, product]));
  const stockMoves = [];
  const stockableLines = [];

  for (const line of lines ?? []) {
    const productId = line.product_id as string | null;
    if (!productId) continue;

    const product = productsById.get(productId);
    if (!product || product.type === "service" || !product.track_stock) continue;

    const quantity = Number(line.quantity ?? 0);
    const currentStock = Number(product.current_stock ?? 0);
    if (direction === "out" && currentStock < quantity) {
      const label = String(product.name ?? product.sku ?? productId);
      return { error: `Stock insuffisant pour l'article ${label}.` };
    }

    stockableLines.push({ line, productId, quantity, currentStock });
  }

  for (const item of stockableLines) {
    const nextStock = direction === "out" ? item.currentStock - item.quantity : item.currentStock + item.quantity;

    const { error: stockError } = await supabase
      .from("products")
      .update({ current_stock: nextStock })
      .eq("organization_id", organizationId)
      .eq("id", item.productId);

    if (stockError) return { error: stockError.message };

    stockMoves.push({
      organization_id: organizationId,
      warehouse_id: warehouseResult.warehouseId,
      product_id: item.productId,
      source_document_id: documentId,
      source_line_id: item.line.id,
      move_type: moveType,
      direction,
      quantity: item.quantity,
      movement_date: new Date().toISOString(),
      notes: direction === "out" ? "Validation bon de livraison" : "Validation retour client",
      created_by: userId,
    });
  }

  if (stockMoves.length > 0) {
    const { error: moveError } = await supabase.from("stock_moves").insert(stockMoves);
    if (moveError) return { error: moveError.message };
  }

  return {};
}

export async function createSalesQuote(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client ou un prospect." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "quote",
      document_number: "",
      customer_id: customerId,
      document_date: text(formData, "document_date") ?? new Date().toISOString().split("T")[0],
      valid_until: text(formData, "valid_until"),
      status: "draft",
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id, document_number")
    .single();

  if (error || !document) {
    return { success: false, error: error?.message ?? "Impossible de creer le devis." };
  }

  const { error: lineError } = await insertLines(document.id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente");
  revalidatePath("/vente/devis");
  redirect(`/vente/devis/${document.id}`);
}

export async function updateSalesQuote(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant devis manquant." };

  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client ou un prospect." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("sales_documents")
    .select("status, document_type")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) return { success: false, error: "Devis introuvable." };
  if (existing.document_type !== "quote") return { success: false, error: "Ce document n'est pas un devis." };
  if (existing.status !== "draft") return { success: false, error: "Seul un devis brouillon peut etre modifie." };

  const { error: updateError } = await supabase
    .from("sales_documents")
    .update({
      customer_id: customerId,
      document_date: text(formData, "document_date"),
      valid_until: text(formData, "valid_until"),
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  const { error: deleteError } = await supabase
    .from("sales_document_lines")
    .delete()
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  const { error: lineError } = await insertLines(id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente/devis");
  revalidatePath(`/vente/devis/${id}`);
  redirect(`/vente/devis/${id}`);
}

export async function createSalesOrder(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client ou un prospect." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "order",
      document_number: "",
      customer_id: customerId,
      document_date: text(formData, "document_date") ?? new Date().toISOString().split("T")[0],
      expected_delivery_date: text(formData, "expected_delivery_date"),
      status: "draft",
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id, document_number")
    .single();

  if (error || !document) {
    return { success: false, error: error?.message ?? "Impossible de creer la commande." };
  }

  const { error: lineError } = await insertLines(document.id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente");
  revalidatePath("/vente/commandes");
  redirect(`/vente/commandes/${document.id}`);
}

export async function updateSalesOrder(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant commande manquant." };

  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client ou un prospect." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("sales_documents")
    .select("status, document_type")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) return { success: false, error: "Commande introuvable." };
  if (existing.document_type !== "order") return { success: false, error: "Ce document n'est pas une commande." };
  if (existing.status !== "draft") return { success: false, error: "Seule une commande brouillon peut etre modifiee." };

  const { error: updateError } = await supabase
    .from("sales_documents")
    .update({
      customer_id: customerId,
      document_date: text(formData, "document_date"),
      expected_delivery_date: text(formData, "expected_delivery_date"),
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  const { error: deleteError } = await supabase
    .from("sales_document_lines")
    .delete()
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  const { error: lineError } = await insertLines(id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente/commandes");
  revalidatePath(`/vente/commandes/${id}`);
  redirect(`/vente/commandes/${id}`);
}

export async function archiveSalesDocument(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const documentType = text(formData, "document_type") as SalesDocumentType | null;
  if (!id) return { success: false, error: "Document introuvable." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_documents")
    .update({ status: "cancelled", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/vente");
  if (documentType === "order") redirect("/vente/commandes");
  if (documentType === "delivery_note") redirect("/vente/livraisons");
  if (documentType === "return_note") redirect("/vente/retours");
  redirect("/vente/devis");
}

async function updateDocumentStatus(
  id: string,
  status: string,
  allowedType: SalesDocumentType,
  allowedStatuses?: string[],
) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: document, error: fetchError } = await supabase
    .from("sales_documents")
    .select("document_type, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !document) return { success: false, error: "Document introuvable." };
  if (document.document_type !== allowedType) return { success: false, error: "Type de document invalide." };
  if (allowedStatuses && !allowedStatuses.includes(document.status)) {
    return { success: false, error: "Ce document ne peut pas changer de statut dans son etat actuel." };
  }

  const { error } = await supabase
    .from("sales_documents")
    .update({ status })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markQuoteAsSent(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const result = await updateDocumentStatus(id, "sent", "quote");
  revalidatePath(`/vente/devis/${id}`);
  return result;
}

export async function acceptQuote(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const result = await updateDocumentStatus(id, "accepted", "quote");
  revalidatePath(`/vente/devis/${id}`);
  return result;
}

export async function rejectQuote(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const result = await updateDocumentStatus(id, "rejected", "quote");
  revalidatePath(`/vente/devis/${id}`);
  return result;
}

export async function convertQuoteToOrder(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("sales_documents")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (quoteError || !quote) return { success: false, error: "Devis introuvable." };
  if (quote.document_type !== "quote") return { success: false, error: "Ce document n'est pas un devis." };
  if (!["draft", "sent", "accepted"].includes(quote.status)) {
    return { success: false, error: "Ce devis ne peut pas etre converti." };
  }

  const { data: order, error: orderError } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "order",
      document_number: "",
      customer_id: quote.customer_id,
      source_document_id: quote.id,
      document_date: new Date().toISOString().split("T")[0],
      status: "draft",
      subtotal_ht: quote.subtotal_ht,
      tax_total: quote.tax_total,
      total_ttc: quote.total_ttc,
      notes: quote.notes,
      internal_notes: quote.internal_notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (orderError || !order) return { success: false, error: orderError?.message ?? "Impossible de creer la commande." };

  const { error: lineError } = await copyLinesToDocument(quote.id, order.id, workspace.organization.id);
  if (lineError) return { success: false, error: lineError.message };

  await supabase
    .from("sales_documents")
    .update({ status: "converted" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", quote.id);

  revalidatePath("/vente/devis");
  revalidatePath("/vente/commandes");
  redirect(`/vente/commandes/${order.id}`);
}

export async function confirmOrder(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Commande introuvable." };
  const result = await updateDocumentStatus(id, "confirmed", "order", ["draft"]);
  if (result.success) {
    await convertProspectToCustomerAfterOrderConfirmation(workspace.organization.id, workspace.userId, id);
    revalidatePath("/tiers");
  }
  revalidatePath(`/vente/commandes/${id}`);
  return result;
}

export async function createDeliveryFromOrder(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Commande introuvable." };
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("sales_documents")
    .select("document_type, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (!order || order.document_type !== "order") return { success: false, error: "Commande introuvable." };
  if (!["confirmed", "partially_delivered"].includes(order.status)) {
    return { success: false, error: "La commande doit etre confirmee avant livraison." };
  }

  redirect(`/vente/commandes/${id}/livrer`);
}

export async function createDeliveryNoteFromOrder(
  prev: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "order_id");
  if (!id) return { success: false, error: "Commande introuvable." };
  const supabase = await createClient();
  const requestedLines = parseQuantityLines(formData);
  if (requestedLines.length === 0) return { success: false, error: "Selectionnez au moins une quantite a livrer." };

  const { data: order, error: orderError } = await supabase
    .from("sales_documents")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (orderError || !order) return { success: false, error: "Commande introuvable." };
  if (order.document_type !== "order") return { success: false, error: "Ce document n'est pas une commande." };
  if (!["confirmed", "partially_delivered"].includes(order.status)) {
    return { success: false, error: "La commande doit etre confirmee avant livraison." };
  }

  const requestedIds = requestedLines.map((line) => line.source_line_id);
  const { data: orderLines, error: lineFetchError } = await supabase
    .from("sales_document_lines")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", id)
    .in("id", requestedIds);

  if (lineFetchError || !orderLines) return { success: false, error: lineFetchError?.message ?? "Lignes introuvables." };

  const deliveredResult = await getValidatedDeliveredQuantityBySourceLine(workspace.organization.id, requestedIds, "delivery_note");
  if ("error" in deliveredResult) return { success: false, error: deliveredResult.error };
  const deliveredByLine = deliveredResult.quantities ?? {};

  const lines: (SalesLineFormValue & {
    source_line_id: string;
    ordered_quantity: number;
    delivered_quantity: number;
    remaining_quantity: number;
  })[] = [];
  for (const requestedLine of requestedLines) {
    const sourceLine = orderLines.find((line) => line.id === requestedLine.source_line_id);
    if (!sourceLine) return { success: false, error: "Une ligne de commande est introuvable." };

    const remaining = Number(sourceLine.quantity ?? 0) - (deliveredByLine[sourceLine.id] ?? 0);
    if (requestedLine.quantity <= 0 || requestedLine.quantity > remaining) {
      return { success: false, error: "Une quantite a livrer depasse le reliquat disponible." };
    }

    const line = calculateSalesLine({
      id: sourceLine.id,
      mode: sourceLine.product_id ? "product" : "free",
      product_id: sourceLine.product_id ?? "",
      product_name: sourceLine.product_name ?? "",
      description: sourceLine.description,
      quantity: requestedLine.quantity,
      unit_id: sourceLine.unit_id ?? "",
      unit_name: sourceLine.unit_name ?? "",
      unit_price_ht: Number(sourceLine.unit_price_ht ?? 0),
      discount_rate: Number(sourceLine.discount_rate ?? 0),
      tax_rate_id: sourceLine.tax_rate_id ?? "",
      tax_rate: Number(sourceLine.tax_rate ?? 0),
      subtotal_ht: 0,
      tax_amount: 0,
      total_ttc: 0,
    });

    lines.push({
      ...line,
      source_line_id: sourceLine.id,
      ordered_quantity: Number(sourceLine.quantity ?? 0),
      delivered_quantity: requestedLine.quantity,
      remaining_quantity: Math.max(remaining - requestedLine.quantity, 0),
    });
  }

  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };
  const totals = calculateSalesTotals(lines);
  const deliveryAddress = text(formData, "delivery_address");
  const deliveryNotes = text(formData, "notes");
  const notes = [
    deliveryAddress ? `Adresse de livraison : ${deliveryAddress}` : null,
    deliveryNotes,
  ].filter(Boolean).join("\n\n") || order.notes;

  const { data: delivery, error: deliveryError } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "delivery_note",
      document_number: "",
      customer_id: order.customer_id,
      source_document_id: order.id,
      related_order_id: order.id,
      document_date: text(formData, "document_date") ?? new Date().toISOString().split("T")[0],
      status: "draft",
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes,
      internal_notes: text(formData, "internal_notes") ?? order.internal_notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (deliveryError || !delivery) return { success: false, error: deliveryError?.message ?? "Impossible de creer le bon de livraison." };

  const { error: lineError } = await supabase
    .from("sales_document_lines")
    .insert(lines.map((line, index) => lineToPayload(delivery.id, workspace.organization.id, line, index)));

  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente/commandes");
  revalidatePath("/vente/livraisons");
  redirect(`/vente/livraisons/${delivery.id}`);
}

export async function createManualDeliveryNote(
  prev: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  return createDeliveryNoteFromOrder(prev, formData);
}

export async function validateDeliveryNote(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Bon de livraison introuvable." };
  const supabase = await createClient();
  const { data: delivery, error } = await supabase
    .from("sales_documents")
    .select("id, document_type, status, stock_updated_at, related_order_id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !delivery) return { success: false, error: "Bon de livraison introuvable." };
  if (delivery.document_type !== "delivery_note") return { success: false, error: "Type de document invalide." };
  if (delivery.status !== "draft") return { success: false, error: "Seul un BL brouillon peut etre valide." };
  if (delivery.stock_updated_at) return { success: false, error: "Le stock de ce BL a deja ete traite." };

  const { data: deliveryLines, error: deliveryLineError } = await supabase
    .from("sales_document_lines")
    .select("id, source_line_id, quantity")
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", id);

  if (deliveryLineError || !deliveryLines || deliveryLines.length === 0) {
    return { success: false, error: "Le BL ne contient aucune ligne." };
  }

  const sourceLineIds = deliveryLines.map((line) => line.source_line_id).filter(Boolean) as string[];
  const { data: orderLines, error: orderLineError } = await supabase
    .from("sales_document_lines")
    .select("id, quantity")
    .eq("organization_id", workspace.organization.id)
    .in("id", sourceLineIds);

  if (orderLineError || !orderLines) return { success: false, error: "Impossible de verifier les reliquats." };
  const deliveredResult = await getValidatedDeliveredQuantityBySourceLine(workspace.organization.id, sourceLineIds, "delivery_note");
  if ("error" in deliveredResult) return { success: false, error: deliveredResult.error };
  const deliveredByLine = deliveredResult.quantities ?? {};

  for (const line of deliveryLines) {
    const sourceLineId = line.source_line_id as string | null;
    const sourceLine = orderLines.find((item) => item.id === sourceLineId);
    if (!sourceLine) return { success: false, error: "Une ligne source est introuvable." };
    const remaining = Number(sourceLine.quantity ?? 0) - (deliveredByLine[sourceLineId ?? ""] ?? 0);
    if (Number(line.quantity ?? 0) <= 0 || Number(line.quantity ?? 0) > remaining) {
      return { success: false, error: "Une quantite de BL depasse le reliquat de commande." };
    }
  }

  const stockResult = await applyStockMovesForDocument(
    workspace.organization.id,
    id,
    "delivery_out",
    "out",
    workspace.userId,
  );
  if (stockResult.error) return { success: false, error: stockResult.error };

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("sales_documents")
    .update({ status: "validated", validated_at: now, stock_updated_at: now })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .is("stock_updated_at", null);

  if (updateError) return { success: false, error: updateError.message };
  if (delivery.related_order_id) {
    await updateOrderDeliveryStatus(workspace.organization.id, delivery.related_order_id);
    revalidatePath(`/vente/commandes/${delivery.related_order_id}`);
  }

  revalidatePath(`/vente/livraisons/${id}`);
  return { success: true };
}

export async function markDeliveryAsDelivered(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Bon de livraison introuvable." };
  const result = await updateDocumentStatus(id, "delivered", "delivery_note", ["validated"]);
  if (result.success) {
    const supabase = await createClient();
    await supabase
      .from("sales_documents")
      .update({ delivered_at: new Date().toISOString() })
      .eq("organization_id", workspace.organization.id)
      .eq("id", id);
  }
  revalidatePath(`/vente/livraisons/${id}`);
  return result;
}

export async function createReturnFromDelivery(
  prev: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const deliveryId = text(formData, "delivery_id");
  const returnReason = text(formData, "return_reason");
  const details = text(formData, "return_reason_details");
  if (!deliveryId) return { success: false, error: "Bon de livraison introuvable." };
  if (!returnReason) return { success: false, error: "Indiquez un motif de retour." };

  const requestedLines = parseQuantityLines(formData);
  if (requestedLines.length === 0) return { success: false, error: "Selectionnez au moins une quantite a retourner." };

  const supabase = await createClient();
  const { data: delivery, error: deliveryError } = await supabase
    .from("sales_documents")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", deliveryId)
    .maybeSingle();

  if (deliveryError || !delivery) return { success: false, error: "Bon de livraison introuvable." };
  if (delivery.document_type !== "delivery_note") return { success: false, error: "Ce document n'est pas un BL." };
  if (!["validated", "delivered"].includes(delivery.status)) {
    return { success: false, error: "Le BL doit etre valide avant retour." };
  }

  const requestedIds = requestedLines.map((line) => line.source_line_id);
  const { data: deliveryLines, error: lineFetchError } = await supabase
    .from("sales_document_lines")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", deliveryId)
    .in("id", requestedIds);

  if (lineFetchError || !deliveryLines) return { success: false, error: lineFetchError?.message ?? "Lignes introuvables." };

  const returnedResult = await getValidatedDeliveredQuantityBySourceLine(workspace.organization.id, requestedIds, "return_note");
  if ("error" in returnedResult) return { success: false, error: returnedResult.error };
  const returnedByLine = returnedResult.quantities ?? {};

  const lines: (SalesLineFormValue & { source_line_id: string; ordered_quantity: number })[] = [];
  for (const requestedLine of requestedLines) {
    const sourceLine = deliveryLines.find((line) => line.id === requestedLine.source_line_id);
    if (!sourceLine) return { success: false, error: "Une ligne de livraison est introuvable." };

    const returnable = Number(sourceLine.quantity ?? 0) - (returnedByLine[sourceLine.id] ?? 0);
    if (requestedLine.quantity <= 0 || requestedLine.quantity > returnable) {
      return { success: false, error: "Une quantite retour depasse le retournable disponible." };
    }

    const line = calculateSalesLine({
      id: sourceLine.id,
      mode: sourceLine.product_id ? "product" : "free",
      product_id: sourceLine.product_id ?? "",
      product_name: sourceLine.product_name ?? "",
      description: sourceLine.description,
      quantity: requestedLine.quantity,
      unit_id: sourceLine.unit_id ?? "",
      unit_name: sourceLine.unit_name ?? "",
      unit_price_ht: Number(sourceLine.unit_price_ht ?? 0),
      discount_rate: Number(sourceLine.discount_rate ?? 0),
      tax_rate_id: sourceLine.tax_rate_id ?? "",
      tax_rate: Number(sourceLine.tax_rate ?? 0),
      subtotal_ht: 0,
      tax_amount: 0,
      total_ttc: 0,
    });

    lines.push({ ...line, source_line_id: sourceLine.id, ordered_quantity: Number(sourceLine.quantity ?? 0) });
  }

  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };
  const totals = calculateSalesTotals(lines);

  const { data: returnNote, error: returnError } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "return_note",
      document_number: "",
      customer_id: delivery.customer_id,
      source_document_id: delivery.id,
      related_order_id: delivery.related_order_id,
      related_delivery_id: delivery.id,
      document_date: new Date().toISOString().split("T")[0],
      status: "draft",
      return_reason: returnReason,
      internal_notes: details,
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (returnError || !returnNote) return { success: false, error: returnError?.message ?? "Impossible de creer le retour." };

  const { error: lineError } = await supabase
    .from("sales_document_lines")
    .insert(lines.map((line, index) => lineToPayload(returnNote.id, workspace.organization.id, line, index)));

  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente/retours");
  revalidatePath(`/vente/livraisons/${delivery.id}`);
  redirect(`/vente/retours/${returnNote.id}`);
}

export async function validateReturnNote(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Bon de retour introuvable." };
  const supabase = await createClient();
  const { data: returnNote, error } = await supabase
    .from("sales_documents")
    .select("id, document_type, status, stock_updated_at, return_reason")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !returnNote) return { success: false, error: "Bon de retour introuvable." };
  if (returnNote.document_type !== "return_note") return { success: false, error: "Type de document invalide." };
  if (returnNote.status !== "draft") return { success: false, error: "Seul un retour brouillon peut etre valide." };
  if (!returnNote.return_reason) return { success: false, error: "Indiquez un motif de retour." };
  if (returnNote.stock_updated_at) return { success: false, error: "Le stock de ce retour a deja ete traite." };

  const { data: returnLines, error: returnLineError } = await supabase
    .from("sales_document_lines")
    .select("id, source_line_id, quantity")
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", id);

  if (returnLineError || !returnLines || returnLines.length === 0) {
    return { success: false, error: "Le retour ne contient aucune ligne." };
  }

  const sourceLineIds = returnLines.map((line) => line.source_line_id).filter(Boolean) as string[];
  const { data: deliveryLines, error: deliveryLineError } = await supabase
    .from("sales_document_lines")
    .select("id, quantity")
    .eq("organization_id", workspace.organization.id)
    .in("id", sourceLineIds);

  if (deliveryLineError || !deliveryLines) return { success: false, error: "Impossible de verifier les quantites retournables." };
  const returnedResult = await getValidatedDeliveredQuantityBySourceLine(workspace.organization.id, sourceLineIds, "return_note");
  if ("error" in returnedResult) return { success: false, error: returnedResult.error };
  const returnedByLine = returnedResult.quantities ?? {};

  for (const line of returnLines) {
    const sourceLineId = line.source_line_id as string | null;
    const sourceLine = deliveryLines.find((item) => item.id === sourceLineId);
    if (!sourceLine) return { success: false, error: "Une ligne de livraison est introuvable." };
    const returnable = Number(sourceLine.quantity ?? 0) - (returnedByLine[sourceLineId ?? ""] ?? 0);
    if (Number(line.quantity ?? 0) <= 0 || Number(line.quantity ?? 0) > returnable) {
      return { success: false, error: "Une quantite retour depasse le retournable disponible." };
    }
  }

  const stockResult = await applyStockMovesForDocument(
    workspace.organization.id,
    id,
    "customer_return_in",
    "in",
    workspace.userId,
  );
  if (stockResult.error) return { success: false, error: stockResult.error };

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("sales_documents")
    .update({ status: "validated", returned_at: now, stock_updated_at: now })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .is("stock_updated_at", null);

  if (updateError) return { success: false, error: updateError.message };
  revalidatePath(`/vente/retours/${id}`);
  revalidatePath("/vente/retours");
  return { success: true };
}
