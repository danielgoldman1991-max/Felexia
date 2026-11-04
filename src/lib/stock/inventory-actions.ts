"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProWorkspace } from "@/lib/pro-access";
import { hasFullErpAccess } from "@/lib/launch-access";
import { inventoryAdjustments } from "@/lib/stock/inventory";
import { recordStockMovementsAtomic } from "@/lib/stock/record-stock-movements";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";

function isRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

async function requireInventoryWrite() {
  const workspace = await requireProWorkspace({ module: "stock" });
  if (!(await hasFullErpAccess(workspace.organization.id))) throw new Error("L’inventaire physique est réservé à l’offre PRO.");
  return workspace;
}

async function seedInventoryLines(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, countId: string, warehouseId: string) {
  const levels = await supabase.from("stock_levels").select("product_id, quantity").eq("organization_id", organizationId).eq("warehouse_id", warehouseId).gt("quantity", 0);
  if (levels.error) return { error: levels.error.message };
  const lines = (levels.data ?? []).map((level) => ({
    organization_id: organizationId,
    count_id: countId,
    product_id: level.product_id,
    warehouse_id: warehouseId,
    theoretical_quantity: Number(level.quantity ?? 0),
    counted_quantity: Number(level.quantity ?? 0),
    variance_quantity: 0,
  }));
  if (lines.length === 0) return { error: null as string | null };
  const inserted = await supabase.from("stock_count_lines").insert(lines);
  if (inserted.error) return { error: inserted.error.message.includes("status") ? "La feuille de comptage nécessite la migration 131." : inserted.error.message };
  return { error: null as string | null };
}

export async function ensureInventoryCountLines(countId: string) {
  const workspace = await requireInventoryWrite();
  const supabase = await createClient();
  const session = await supabase.from("stock_counts").select("id, status, warehouse_id").eq("organization_id", workspace.organization.id).eq("id", countId).maybeSingle();
  if (!session.data || session.data.status === "validated" || !session.data.warehouse_id) return;
  const existing = await supabase.from("stock_count_lines").select("id").eq("organization_id", workspace.organization.id).eq("count_id", countId).limit(1);
  if ((existing.data ?? []).length > 0) return;
  await seedInventoryLines(supabase, workspace.organization.id, countId, session.data.warehouse_id);
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

type FormState = { success: boolean; error?: string };

export async function createInventorySessionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  try {
    const workspace = await requireInventoryWrite();
    const warehouseId = text(formData, "warehouse_id");
    if (!warehouseId) return { success: false, error: "Choisissez un emplacement." };
    const supabase = await createClient();
    const number = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
    const created = await supabase.from("stock_counts").insert({
      organization_id: workspace.organization.id,
      count_number: number,
      counted_on: text(formData, "counted_on") ?? new Date().toISOString().slice(0, 10),
      status: "draft",
      warehouse_id: warehouseId,
      notes: text(formData, "notes"),
    }).select("id").single();
    if (isMissingSchema(created.error)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
    if (created.error || !created.data) return { success: false, error: created.error?.message ?? "La session n’a pas pu être créée." };
    const seeded = await seedInventoryLines(supabase, workspace.organization.id, created.data.id, warehouseId);
    if (seeded.error) return { success: false, error: seeded.error };
    revalidatePath("/stock/inventaire/sessions");
    redirect(`/stock/inventaire/sessions/${created.data.id}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "La session n’a pas pu être créée." };
  }
}

export async function saveInventoryCountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  try {
    const workspace = await requireInventoryWrite();
    const countId = text(formData, "count_id");
    if (!countId) return { success: false, error: "Session introuvable." };
    const supabase = await createClient();
    const existing = await supabase.from("stock_counts").select("id, status").eq("organization_id", workspace.organization.id).eq("id", countId).maybeSingle();
    if (existing.data?.status === "validated") return { success: false, error: "Cette session est validée. Les quantités sont figées." };
    const raw = text(formData, "lines");
    const lines = raw ? JSON.parse(raw) as Array<{ id: string; theoretical: number; counted: number }> : [];
    for (const line of lines) {
      const variance = Math.round((line.counted - line.theoretical) * 1000) / 1000;
      const updated = await supabase.from("stock_count_lines").update({
        counted_quantity: line.counted,
        variance_quantity: variance,
      }).eq("organization_id", workspace.organization.id).eq("id", line.id).eq("count_id", countId);
      if (updated.error) return { success: false, error: updated.error.message.includes("INVENTORY_LOCKED") ? "Cette session est validée. Les quantités sont figées." : updated.error.message };
    }
    revalidatePath(`/stock/inventaire/sessions/${countId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Le comptage n’a pas pu être enregistré." };
  }
}

export async function validateInventorySessionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  try {
    const workspace = await requireInventoryWrite();
    const countId = text(formData, "count_id");
    if (!countId) return { success: false, error: "Session introuvable." };
    const supabase = await createClient();
    const session = await supabase.from("stock_counts").select("id, status, warehouse_id, count_number").eq("organization_id", workspace.organization.id).eq("id", countId).maybeSingle();
    if (!session.data) return { success: false, error: "Session introuvable." };
    if (session.data.status === "validated") return { success: false, error: "Cette session est déjà validée." };
    if (!session.data.warehouse_id) return { success: false, error: "La session n’a pas d’emplacement." };
    const submitted = text(formData, "lines");
    if (submitted) {
      const parsed = JSON.parse(submitted) as Array<{ id: string; theoretical: number; counted: number }>;
      for (const line of parsed) {
        const variance = Math.round((line.counted - line.theoretical) * 1000) / 1000;
        await supabase.from("stock_count_lines").update({ counted_quantity: line.counted, variance_quantity: variance }).eq("organization_id", workspace.organization.id).eq("id", line.id).eq("count_id", countId);
      }
    }
    const linesResult = await supabase.from("stock_count_lines").select("id, product_id, theoretical_quantity, counted_quantity").eq("organization_id", workspace.organization.id).eq("count_id", countId);
    const adjustments = inventoryAdjustments((linesResult.data ?? []).map((line) => ({
      productId: line.product_id as string,
      theoretical: Number(line.theoretical_quantity ?? 0),
      counted: Number(line.counted_quantity ?? 0),
    })));
    if (adjustments.length > 0) {
      const movement = await recordStockMovementsAtomic({
        organizationId: workspace.organization.id,
        operationKey: `inventory-${countId}`,
        movements: adjustments.map((line) => ({
          product_id: line.productId,
          warehouse_id: session.data!.warehouse_id as string,
          move_type: line.direction === "in" ? "adjustment_in" : "adjustment_out",
          direction: line.direction,
          quantity: line.quantity,
          movement_date: new Date().toISOString(),
          notes: `Inventaire ${session.data!.count_number}`,
          source_document_id: countId,
        })),
      });
      if (movement.error) return { success: false, error: movement.error };
    }
    const closed = await supabase.from("stock_counts").update({ status: "validated", validated_at: new Date().toISOString() }).eq("organization_id", workspace.organization.id).eq("id", countId);
    if (closed.error) return { success: false, error: closed.error.message };
    revalidatePath("/stock/inventaire/sessions");
    revalidatePath(`/stock/inventaire/sessions/${countId}`);
    redirect(`/stock/inventaire/sessions/${countId}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "La session n’a pas pu être validée." };
  }
}
