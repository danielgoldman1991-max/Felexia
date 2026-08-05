"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TreasuryActionResult } from "@/lib/treasury-types";
import { computeWeightedAmount } from "@/lib/treasury/treasury-forecast";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampProbability(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export async function createTreasuryForecastItem(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const label = text(formData, "label");
  if (!label) return { success: false, error: "Le libelle est obligatoire." };
  const directionRaw = text(formData, "direction");
  if (directionRaw !== "inflow" && directionRaw !== "outflow") return { success: false, error: "Type invalide." };
  const forecastDate = text(formData, "forecast_date");
  if (!forecastDate) return { success: false, error: "La date prevue est obligatoire." };
  const amount = num(formData.get("amount"));
  if (amount <= 0) return { success: false, error: "Le montant doit etre superieur a 0." };
  const probability = clampProbability(num(formData.get("probability")) || 100);
  const category = text(formData, "category");
  const treasuryAccountId = text(formData, "treasury_account_id");
  const notes = text(formData, "notes");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treasury_forecast_items")
    .insert({
      organization_id: workspace.organization.id,
      item_type: "manual",
      direction: directionRaw,
      source_type: "manual",
      label,
      description: null,
      forecast_date: forecastDate,
      amount,
      probability,
      weighted_amount: computeWeightedAmount(amount, probability, directionRaw, "realistic"),
      status: "planned",
      category,
      treasury_account_id: treasuryAccountId,
      is_manual: true,
      notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer la prevision." };
  revalidatePath("/tresorerie/previsions");
  redirect(`/tresorerie/previsions?created=${data.id}`);
}

export async function updateTreasuryForecastItem(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Prevision introuvable." };
  const label = text(formData, "label");
  if (!label) return { success: false, error: "Le libelle est obligatoire." };
  const directionRaw = text(formData, "direction");
  if (directionRaw !== "inflow" && directionRaw !== "outflow") return { success: false, error: "Type invalide." };
  const forecastDate = text(formData, "forecast_date");
  if (!forecastDate) return { success: false, error: "La date prevue est obligatoire." };
  const amount = num(formData.get("amount"));
  if (amount <= 0) return { success: false, error: "Le montant doit etre superieur a 0." };
  const probability = clampProbability(num(formData.get("probability")) || 100);
  const status = text(formData, "status") ?? "planned";
  const category = text(formData, "category");
  const treasuryAccountId = text(formData, "treasury_account_id");
  const notes = text(formData, "notes");

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("treasury_forecast_items")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { success: false, error: fetchError.message };
  if (!existing) return { success: false, error: "Prevision introuvable." };

  const { error } = await supabase
    .from("treasury_forecast_items")
    .update({
      label,
      direction: directionRaw,
      forecast_date: forecastDate,
      amount,
      probability,
      weighted_amount: computeWeightedAmount(amount, probability, directionRaw, "realistic"),
      status,
      category,
      treasury_account_id: treasuryAccountId,
      notes,
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tresorerie/previsions");
  redirect("/tresorerie/previsions");
}

export async function setTreasuryForecastItemStatus(
  prev: TreasuryActionResult,
  formData: FormData,
): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) return { success: false, error: "Prevision introuvable." };
  const allowed = ["planned", "confirmed", "realized", "cancelled", "ignored"];
  if (!allowed.includes(status)) return { success: false, error: "Statut invalide." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("treasury_forecast_items")
    .update({ status })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tresorerie/previsions");
  return { success: true };
}

export async function archiveTreasuryForecastItem(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Prevision introuvable." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("treasury_forecast_items")
    .update({ archived_at: new Date().toISOString(), status: "ignored" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tresorerie/previsions");
  return { success: true };
}
