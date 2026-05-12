"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActivatePlanState = {
  error: string | null;
};

export async function activatePlanAction(
  _prev: ActivatePlanState,
  formData: FormData,
): Promise<ActivatePlanState> {
  const planSlug = String(formData.get("planSlug") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");

  if (!planSlug || !organizationId) {
    return { error: "Paramètres manquants." };
  }

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("slug", planSlug)
    .single();

  if (!plan) {
    return { error: "Plan introuvable." };
  }

  await supabase
    .from("organization_subscriptions")
    .delete()
    .eq("organization_id", organizationId);

  const { error } = await supabase.from("organization_subscriptions").insert({
    organization_id: organizationId,
    plan_id: plan.id,
    status: "active",
    billing_interval: "monthly",
    current_period_start: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
