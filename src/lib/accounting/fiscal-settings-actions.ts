"use server";

import { revalidatePath } from "next/cache";
import { requireProWorkspace } from "@/lib/pro-access";
import { isMissingRelation } from "@/lib/hr/notify";
import { createClient } from "@/lib/supabase/server";

const editors = new Set(["owner", "admin", "accountant", "hr_manager"]);

export async function saveFiscalSettingsAction(previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  void previous;
  try {
    const workspace = await requireProWorkspace();
    if (!editors.has(workspace.role ?? "")) return { error: "Seuls l'administrateur et le comptable enregistrent ces paramètres." };
    const frequency = String(formData.get("vat_frequency") ?? "monthly");
    if (frequency !== "monthly" && frequency !== "quarterly") return { error: "Périodicité de TVA inconnue." };
    const rateRaw = String(formData.get("is_rate_percent") ?? "").trim().replace(",", ".");
    const rate = rateRaw === "" ? null : Number(rateRaw);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 40)) return { error: "Le taux d'IS doit être vide ou compris entre 0 et 40." };
    const supabase = await createClient();
    const saved = await supabase.from("organization_fiscal_settings").upsert({
      organization_id: workspace.organization.id,
      cnss_affiliation: clean(formData.get("cnss_affiliation")),
      vat_frequency: frequency,
      is_rate_percent: rate,
      activity_code: clean(formData.get("activity_code")),
      filing_note: clean(formData.get("filing_note")),
      updated_at: new Date().toISOString(),
    });
    if (isMissingRelation(saved.error)) return { error: "L'enregistrement attend la migration 124. Aucun dépôt n'a été tenté." };
    if (saved.error) return { error: saved.error.message };
    revalidatePath("/comptabilite/parametres-fiscaux");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Les paramètres n'ont pas été enregistrés." };
  }
}

function clean(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
