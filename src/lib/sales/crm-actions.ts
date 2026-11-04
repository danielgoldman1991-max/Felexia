"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export async function createOpportunity(previous: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  void previous;
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return { error: "Le pipeline est inclus dans l'offre PRO." };
  if (isReadOnlyRole(workspace.role)) return { error: "Votre accès est en lecture seule." };
  const title = String(formData.get("title") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "0").replace(",", "."));
  if (!title || !Number.isFinite(amount) || amount < 0) return { error: "Indiquez un titre et un montant." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_opportunities").insert({
    organization_id: workspace.organization.id,
    title,
    customer_name: String(formData.get("customer_name") ?? "").trim() || null,
    stage: String(formData.get("stage") ?? "qualification"),
    amount,
    expected_on: String(formData.get("expected_on") ?? "").trim() || null,
  });
  if (error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message))) {
    return { error: "Le pipeline attend la migration 119. Le reste de l'application continue de fonctionner." };
  }
  if (error) return { error: error.message };
  revalidatePath("/vente/pipeline");
  redirect("/vente/pipeline");
}
