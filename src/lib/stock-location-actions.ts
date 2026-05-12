"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { StockActionResult, StockLocationStatus, StockLocationType } from "@/lib/stock-types";

const LOCATION_TYPES: StockLocationType[] = ["warehouse", "depot", "store", "site", "zone", "rack", "bin", "vehicle", "project", "other"];
const STATUSES: StockLocationStatus[] = ["active", "inactive", "archived"];

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readPayload(formData: FormData) {
  const locationType = (text(formData, "location_type") ?? "depot") as StockLocationType;
  const status = (text(formData, "status") ?? "active") as StockLocationStatus;
  return {
    name: text(formData, "name"),
    code: text(formData, "code"),
    location_type: LOCATION_TYPES.includes(locationType) ? locationType : "depot",
    parent_id: text(formData, "parent_id"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    country: text(formData, "country") ?? "MA",
    manager_name: text(formData, "manager_name"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    notes: text(formData, "notes"),
    is_default: booleanValue(formData, "is_default"),
    status: STATUSES.includes(status) ? status : "active",
  };
}

async function ensureCodeIsUnique(organizationId: string, code: string | null, excludeId?: string | null) {
  if (!code) return null;
  const supabase = await createClient();
  let query = supabase.from("warehouses").select("id").eq("organization_id", organizationId).eq("code", code).is("archived_at", null).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) return error.message;
  return data ? "Ce code est deja utilise par un autre emplacement." : null;
}

async function applyDefault(organizationId: string, locationId: string) {
  const supabase = await createClient();
  const { error: resetError } = await supabase.from("warehouses").update({ is_default: false }).eq("organization_id", organizationId);
  if (resetError) return resetError.message;
  const { error } = await supabase.from("warehouses").update({ is_default: true, status: "active", archived_at: null }).eq("organization_id", organizationId).eq("id", locationId);
  return error?.message ?? null;
}

export async function createStockLocation(prev: StockActionResult, formData: FormData): Promise<StockActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const payload = readPayload(formData);
  if (!payload.name) return { success: false, error: "Le nom de l'emplacement est obligatoire." };
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return { success: false, error: "Email invalide." };
  const uniqueError = await ensureCodeIsUnique(workspace.organization.id, payload.code);
  if (uniqueError) return { success: false, error: uniqueError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .insert({ ...payload, organization_id: workspace.organization.id, created_by: workspace.userId })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer l'emplacement." };
  if (payload.is_default) {
    const defaultError = await applyDefault(workspace.organization.id, data.id);
    if (defaultError) return { success: false, error: defaultError };
  }
  revalidatePath("/stock/emplacements");
  redirect(`/stock/emplacements/${data.id}`);
}

export async function updateStockLocation(prev: StockActionResult, formData: FormData): Promise<StockActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Emplacement introuvable." };
  const payload = readPayload(formData);
  if (!payload.name) return { success: false, error: "Le nom de l'emplacement est obligatoire." };
  if (payload.parent_id === id) return { success: false, error: "Un emplacement ne peut pas etre son propre parent." };
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return { success: false, error: "Email invalide." };
  const uniqueError = await ensureCodeIsUnique(workspace.organization.id, payload.code, id);
  if (uniqueError) return { success: false, error: uniqueError };

  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").update(payload).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  if (payload.is_default) {
    const defaultError = await applyDefault(workspace.organization.id, id);
    if (defaultError) return { success: false, error: defaultError };
  }
  revalidatePath(`/stock/emplacements/${id}`);
  redirect(`/stock/emplacements/${id}`);
}

export async function archiveStockLocation(prev: StockActionResult, formData: FormData): Promise<StockActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Emplacement introuvable." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("warehouses").select("id, is_default").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (!current) return { success: false, error: "Emplacement introuvable." };
  if (current.is_default) {
    const { count } = await supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("organization_id", workspace.organization.id).eq("status", "active").is("archived_at", null);
    if ((count ?? 0) <= 1) return { success: false, error: "Impossible d'archiver le seul emplacement actif par defaut." };
  }
  const { error } = await supabase.from("warehouses").update({ status: "archived", archived_at: new Date().toISOString(), is_default: false }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/stock/emplacements");
  return { success: true };
}

export async function setDefaultStockLocation(prev: StockActionResult, formData: FormData): Promise<StockActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Emplacement introuvable." };
  const error = await applyDefault(workspace.organization.id, id);
  if (error) return { success: false, error };
  revalidatePath("/stock/emplacements");
  return { success: true };
}
