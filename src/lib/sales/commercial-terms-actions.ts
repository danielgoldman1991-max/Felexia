"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";

function isRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

async function requireCommercialWrite() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) throw new Error("Cette fonction est réservée à l’offre PRO.");
  return workspace;
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function linesFrom(formData: FormData) {
  const raw = text(formData, "lines");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Array<{ description?: string; unit_price?: number; product_id?: string | null }>;
  return parsed
    .filter((line) => (line.description ?? "").trim().length > 0)
    .map((line) => ({
      description: line.description!.trim(),
      unit_price: Number(line.unit_price ?? 0),
      product_id: line.product_id || null,
    }));
}

type FormState = { success: boolean; error?: string };

export async function savePriceListAction(_previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  try {
    const workspace = await requireCommercialWrite();
    const supabase = await createClient();
    const id = text(formData, "id");
    const name = text(formData, "name");
    if (!name) return { success: false, error: "Le nom de la liste est obligatoire." };
    const header = {
      organization_id: workspace.organization.id,
      name,
      customer_id: text(formData, "customer_id"),
      discount_percent: Math.min(100, Math.max(0, Number(formData.get("discount_percent") ?? 0))),
      active: formData.get("active") === "on",
    };
    const saved = id
      ? await supabase.from("customer_price_lists").update(header).eq("organization_id", workspace.organization.id).eq("id", id).select("id").single()
      : await supabase.from("customer_price_lists").insert(header).select("id").single();
    if (isMissingSchema(saved.error)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
    if (saved.error || !saved.data) return { success: false, error: saved.error?.message ?? "La liste n’a pas pu être enregistrée." };
    const listId = saved.data.id as string;
    await supabase.from("customer_price_list_items").delete().eq("organization_id", workspace.organization.id).eq("price_list_id", listId);
    const items = linesFrom(formData).map((line) => ({ ...line, organization_id: workspace.organization.id, price_list_id: listId }));
    if (items.length > 0) {
      const inserted = await supabase.from("customer_price_list_items").insert(items);
      if (inserted.error && !isMissingSchema(inserted.error)) return { success: false, error: inserted.error.message };
    }
    revalidatePath("/vente/prix");
    redirect(`/vente/prix/${listId}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "La liste n’a pas pu être enregistrée." };
  }
}

export async function deletePriceListAction(formData: FormData) {
  const workspace = await requireCommercialWrite();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("customer_price_lists").delete().eq("organization_id", workspace.organization.id).eq("id", id);
  revalidatePath("/vente/prix");
  redirect("/vente/prix");
}

export async function saveReminderRuleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  void _previous;
  try {
    const workspace = await requireCommercialWrite();
    const supabase = await createClient();
    const id = text(formData, "id");
    const payload = {
      organization_id: workspace.organization.id,
      name: text(formData, "name") ?? "Règle de relance",
      days_after_due: Math.max(0, Math.round(Number(formData.get("days_after_due") ?? 7))),
      level: Math.min(3, Math.max(1, Math.round(Number(formData.get("level") ?? 1)))),
      channel: text(formData, "channel") ?? "email",
      subject: text(formData, "subject"),
      message: text(formData, "message"),
      active: formData.get("active") === "on",
    };
    const saved = id
      ? await supabase.from("customer_reminder_rules").update(payload).eq("organization_id", workspace.organization.id).eq("id", id)
      : await supabase.from("customer_reminder_rules").insert(payload);
    if (isMissingSchema(saved.error)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
    if (saved.error) return { success: false, error: saved.error.message };
    revalidatePath("/facturation/relances/regles");
    redirect("/facturation/relances/regles");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "La règle n’a pas pu être enregistrée." };
  }
}

export async function deleteReminderRuleAction(formData: FormData) {
  const workspace = await requireCommercialWrite();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("customer_reminder_rules").delete().eq("organization_id", workspace.organization.id).eq("id", id);
  revalidatePath("/facturation/relances/regles");
  redirect("/facturation/relances/regles");
}
