"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type { StockActionResult, StockMoveDirection, StockMoveType } from "@/lib/stock-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
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
    .insert({ organization_id: organizationId, name: "Dépôt principal", code: "MAIN", status: "active" })
    .select("id")
    .single();

  if (createError || !created) {
    return { error: createError?.message ?? "Impossible de creer le depot principal." };
  }

  return { warehouseId: created.id as string };
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

  const currentStock = Number(product.current_stock ?? 0);
  if (direction === "out" && currentStock < quantity) {
    return { success: false, error: `Stock insuffisant pour l'article ${product.name}.` };
  }

  const warehouseResult = warehouseIdFromForm
    ? { warehouseId: warehouseIdFromForm }
    : await getDefaultWarehouseId(workspace.organization.id);

  if (!warehouseResult.warehouseId) {
    return { success: false, error: warehouseResult.error ?? "Depot principal introuvable." };
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
    warehouse_id: warehouseResult.warehouseId,
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
