"use server";

import { revalidatePath } from "next/cache";
import { requireVatWorkspace } from "@/app/comptabilite/tva/access";
import { createClient } from "@/lib/supabase/server";

export async function saveVatFilingAction(_previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  try {
    const workspace = await requireVatWorkspace();
    const frequency = String(formData.get("vat_frequency") ?? "monthly");
    const regime = String(formData.get("vat_regime") ?? "unspecified");
    if (frequency !== "monthly" && frequency !== "quarterly") return { error: "Périodicité de TVA inconnue." };
    if (!["encaissement", "debit", "mixed", "unspecified"].includes(regime)) return { error: "Régime de TVA inconnu." };
    const supabase = await createClient();
    const saved = await supabase.rpc("set_organization_vat_filing", {
      p_organization_id: workspace.organization.id,
      p_frequency: frequency,
      p_regime: regime,
    });
    if (saved.error) {
      return { error: /set_organization_vat_filing|PGRST202|42883/i.test(saved.error.message) ? "L'enregistrement attend la migration 155. Aucun autre paramètre fiscal n'a été modifié." : saved.error.message };
    }
    revalidatePath("/comptabilite/tva/periodicite");
    revalidatePath("/comptabilite/tva/declarations");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La périodicité TVA n'a pas été enregistrée." };
  }
}
