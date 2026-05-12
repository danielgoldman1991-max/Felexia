"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { getDefaultStockLocationId } from "@/lib/stock-locations";
import type { StockActionResult, StockMoveDirection, StockMoveType } from "@/lib/stock-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function createStockMovement(formData: FormData, moveType: StockMoveType, direction: StockMoveDirection) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const productId = text(formData, "product_id");
  const quantity = numberValue(formData, "quantity");
  const movementDate = text(formData, "movement_date") ?? new Date().toISOString();
  const notes = text(formData, "notes") ?? text(formData, "reason");
  const warehouseIdFromForm = text(formData, "warehouse_id");

  if (!productId) return { success: false, error: "Selectionnez un article." };
  if (quantity <= 0) return { success: false, error: "La quantite doit etre superieure a zero." };

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, type, name, current_stock, unit_id, unit:unit_id(symbol, name)")
    .eq("organization_id", workspace.organization.id)
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) return { success: false, error: "Article introuvable." };
  if (product.type !== "product") return { success: false, error: "Le stock ne concerne que les produits." };

  const unit = Array.isArray(product.unit) ? product.unit[0] : product.unit;
  const unitSymbol = String(unit?.symbol ?? unit?.name ?? "").trim().toUpperCase();
  if (unitSymbol === "U" && !Number.isInteger(quantity)) {
    return { success: false, error: "La quantite doit etre entiere pour l'unite U." };
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
  if (!warehouse) return { success: false, error: "Selectionnez un emplacement de stock actif." };

  const currentStock = Number(product.current_stock ?? 0);
  if (direction === "out") {
    const { data: level } = await supabase
      .from("stock_levels")
      .select("quantity")
      .eq("organization_id", workspace.organization.id)
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();
    const locationStock = Number(level?.quantity ?? 0);
    if (locationStock < quantity) {
      return { success: false, error: `Stock insuffisant dans l'emplacement ${warehouse.name}.` };
    }
  }

  const nextStock = direction === "in" ? currentStock + quantity : currentStock - quantity;
  const { error: stockError } = await supabase
    .from("products")
    .update({ current_stock: nextStock })
    .eq("organization_id", workspace.organization.id)
    .eq("id", productId);

  if (stockError) return { success: false, error: stockError.message };

  const { error: moveError } = await supabase.from("stock_moves").insert({
    organization_id: workspace.organization.id,
    warehouse_id: warehouseId,
    product_id: productId,
    move_type: moveType,
    direction,
    quantity,
    movement_date: movementDate,
    notes,
    created_by: workspace.userId,
  });

  if (moveError) return { success: false, error: moveError.message };

  redirect(`/stock/mouvements?productId=${productId}`);
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
