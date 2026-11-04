"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProWorkspace } from "@/lib/pro-access";
import { getDefaultStockLocationId } from "@/lib/stock-locations";
import { recordStockMovementsAtomic, type AtomicStockMovement } from "@/lib/stock/record-stock-movements";
import { weightedAverageCost } from "@/lib/stock/cump";
import { logAudit } from "@/lib/audit";
import type { StockActionResult, StockMoveDirection } from "@/lib/stock-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function createStockMovement(formData: FormData, moveType: AtomicStockMovement["move_type"], direction: StockMoveDirection) {
  const workspace = await requireProWorkspace({ module: "stock" });
  const supabase = await createClient();
  const productId = text(formData, "product_id");
  const quantity = numberValue(formData, "quantity");
  const movementDate = text(formData, "movement_date") ?? new Date().toISOString();
  const notes = text(formData, "notes") ?? text(formData, "reason");
  const warehouseIdFromForm = text(formData, "warehouse_id");

  if (!productId) return { success: false, error: "Sélectionnez un article." };
  if (quantity <= 0) return { success: false, error: "La quantité doit etre superieure a zero." };

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, type, name, current_stock, purchase_price_ht, unit_id, unit:unit_id(symbol, name)")
    .eq("organization_id", workspace.organization.id)
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) return { success: false, error: "Article introuvable." };
  if (product.type !== "product") return { success: false, error: "Le stock ne concerne que les produits." };

  const unit = Array.isArray(product.unit) ? product.unit[0] : product.unit;
  const unitSymbol = String(unit?.symbol ?? unit?.name ?? "").trim().toUpperCase();
  if (unitSymbol === "U" && !Number.isInteger(quantity)) {
    return { success: false, error: "La quantité doit etre entiere pour l'unite U." };
  }

  let warehouseId: string;
  try {
    warehouseId = warehouseIdFromForm ?? await getDefaultStockLocationId(workspace.organization.id);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Emplacement de stock introuvable." };
  }

  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("organization_id", workspace.organization.id)
    .eq("id", warehouseId)
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (!warehouse) return { success: false, error: "Sélectionnez un emplacement de stock actif." };

  const operationKey = text(formData, "idempotency_key");
  if (!operationKey) return { success: false, error: "Cle de securite du mouvement manquante." };
  const unitCostRaw = text(formData, "unit_cost");
  const unitCost = unitCostRaw == null ? null : Number(unitCostRaw);
  if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) return { success: false, error: "Le coût unitaire doit être positif." };
  const movementResult = await recordStockMovementsAtomic({
    organizationId: workspace.organization.id,
    operationKey,
    movements: [{
      warehouse_id: warehouseId,
      product_id: productId,
      move_type: moveType,
      direction,
      quantity,
      movement_date: movementDate,
      notes,
    }],
  });
  if (movementResult.error) return { success: false, error: movementResult.error };
  if (direction === "in" && unitCost != null) {
    const average = weightedAverageCost(Number(product.current_stock ?? 0), Number(product.purchase_price_ht ?? 0), quantity, unitCost);
    const price = await supabase.from("products").update({ purchase_price_ht: average }).eq("organization_id", workspace.organization.id).eq("id", productId);
    if (price.error) console.error("[stock] purchase price", { code: price.error.code, message: price.error.message });
    const move = await supabase.from("stock_moves").update({ unit_cost: unitCost }).eq("organization_id", workspace.organization.id).eq("stock_operation_key", operationKey).eq("product_id", productId);
    if (move.error && move.error.code !== "42703") console.error("[stock] unit cost", { code: move.error.code, message: move.error.message });
  }

  return { success: true, data: { message: direction === "in" ? "Entrée de stock enregistrée." : "Ajustement de stock enregistré." } };
}

export async function createManualStockEntry(
  previousState: StockActionResult,
  formData: FormData,
): Promise<StockActionResult> {
  void previousState;
  return createStockMovement(formData, "manual_stock_in", "in");
}

export async function createStockAdjustment(
  previousState: StockActionResult,
  formData: FormData,
): Promise<StockActionResult> {
  void previousState;
  const direction = text(formData, "direction");
  const reason = text(formData, "reason");
  if (!reason) return { success: false, error: "Le motif est obligatoire." };
  if (direction === "out") return createStockMovement(formData, "adjustment_out", "out");
  return createStockMovement(formData, "adjustment_in", "in");
}

export async function transferStock(
  previousState: StockActionResult,
  formData: FormData,
): Promise<StockActionResult> {
  void previousState;
  const workspace = await requireProWorkspace({ module: "stock" });
  const productId = text(formData, "product_id");
  const fromId = text(formData, "from_warehouse_id");
  const toId = text(formData, "to_warehouse_id");
  const quantity = numberValue(formData, "quantity");
  if (!productId || !fromId || !toId) return { success: false, error: "Choisissez un article et deux emplacements." };
  if (fromId === toId) return { success: false, error: "L'emplacement de départ et d'arrivée doivent être différents." };
  if (quantity <= 0) return { success: false, error: "La quantité doit être supérieure à zéro." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock_between_locations", {
    p_organization_id: workspace.organization.id,
    p_product_id: productId,
    p_from_warehouse_id: fromId,
    p_to_warehouse_id: toId,
    p_quantity: quantity,
    p_notes: text(formData, "notes"),
  });
  if (error) return { success: false, error: error.message };
  await logAudit(workspace.organization.id, "stock_transfer", "stock_moves", productId, { fromId, toId, quantity });
  return { success: true, data: { message: "Transfert enregistré." } };
}
