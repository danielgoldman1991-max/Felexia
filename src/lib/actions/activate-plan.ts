"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEnabledModulesForPlan, getPlanDefinition, normalizePlanCode } from "@/lib/subscriptions/plans";

export type ActivatePlanState = {
  error: string | null;
};

export async function activatePlanAction(
  _prev: ActivatePlanState,
  formData: FormData,
): Promise<ActivatePlanState> {
  const planSlug = String(formData.get("planSlug") ?? formData.get("planCode") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");

  if (!planSlug || !organizationId) {
    return { error: "Paramètres manquants." };
  }

  const supabase = await createClient();

  const planCode = normalizePlanCode(planSlug);
  const definition = getPlanDefinition(planCode);

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", planCode)
    .maybeSingle();

  if (!plan) {
    return { error: "Plan introuvable." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("organization_subscriptions").upsert({
    organization_id: organizationId,
    plan_id: plan.id,
    plan_code: planCode,
    status: "active",
    billing_cycle: "monthly",
    billing_interval: "monthly",
    current_period_start: now,
    current_period_end: null,
    selected_modules: JSON.parse(JSON.stringify(getEnabledModulesForPlan(planCode))),
    monthly_amount: definition.monthlyPrice,
    yearly_amount: definition.yearlyPrice,
    updated_at: now,
  }, { onConflict: "organization_id" });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
