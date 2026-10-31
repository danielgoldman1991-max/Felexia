"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import type { NumberingActionState } from "@/lib/numbering-types";
import { isNumberingCounterAllowed, MAX_NUMBERING_VALUE, NUMBERING_ADMIN_ERROR, numberingErrorMessage, parseNumberingPeriod, toNumberingCounter } from "@/lib/numbering-model";

export async function correctNumberingCounterAction(_previous: NumberingActionState, formData: FormData): Promise<NumberingActionState> {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) return { success: false, error: NUMBERING_ADMIN_ERROR };
  if (["organizationId", "organization_id", "p_organization_id"].some((key) => formData.has(key))) return { success: false, error: "L’entreprise est déterminée par votre session." };
  const text = (key: string) => typeof formData.get(key) === "string" ? String(formData.get(key)).trim() : "";
  const period = parseNumberingPeriod(text("period"));
  const key = text("counterKey").toLowerCase();
  const revision = text("expectedRevision");
  const numberText = text("nextNumber");
  const reason = text("reason");
  if (!period || !/^\d+$/.test(numberText)) return { success: false, error: "Indiquez une période et un prochain numéro entier valides." };
  const nextNumber = Number(numberText);
  if (!Number.isSafeInteger(nextNumber) || nextNumber < 1 || nextNumber > MAX_NUMBERING_VALUE) return { success: false, error: `Le prochain numéro doit être compris entre 1 et ${MAX_NUMBERING_VALUE}.` };
  if (!/^[a-f0-9]{32}$/.test(revision)) return { success: false, error: "Actualisez les compteurs avant de les corriger." };
  if (reason.length < 5 || reason.length > 500) return { success: false, error: "Indiquez un motif de correction entre 5 et 500 caractères." };
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  if (!isNumberingCounterAllowed(key, fullAccess)) return { success: false, error: "Ce compteur n’est pas disponible dans votre espace." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("correct_numbering_counter", {
      p_organization_id: workspace.organization.id, p_counter_key: key, p_period: `${period}-01`,
      p_next_number: nextNumber, p_expected_revision: revision, p_reason: reason,
    });
    if (error) return { success: false, error: numberingErrorMessage(error) };
    const counter = toNumberingCounter(data);
    revalidatePath("/parametres/numerotation");
    return { success: true, error: null, counter, message: `Compteur corrigé. Le prochain numéro sera ${counter.nextExample}.` };
  } catch {
    console.error("[numbering] correction confirmation failed", { organizationId: workspace.organization.id, counterKey: key });
    return { success: false, error: "Impossible de confirmer la correction. Actualisez les compteurs pour vérifier le résultat avant de réessayer." };
  }
}
