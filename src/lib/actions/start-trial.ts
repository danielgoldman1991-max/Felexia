"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PLAN_CODE, DEFAULT_TRIAL_DAYS, getEnabledModulesForPlan, getPlanDefinition, normalizePlanCode } from "@/lib/subscriptions/plans";

export async function startTrialAction(prev: { error: string | null } | null, formData: FormData) {
  const organizationId = formData.get("organizationId") as string;
  const billingInterval = formData.get("billingInterval") === "yearly" ? "yearly" : "monthly";
  const planCode = normalizePlanCode(String(formData.get("planCode") ?? DEFAULT_PLAN_CODE));

  if (!organizationId) {
    return { error: "Organization ID requis" };
  }

  const supabase = await createClient();

  const trialStart = new Date().toISOString();
  const trialEnd = new Date(Date.now() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const definition = getPlanDefinition(planCode);

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", planCode)
    .maybeSingle();

  // Check if a subscription already exists
  const { data: existingSub } = await supabase
    .from("organization_subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const subscriptionPayload = {
    organization_id: organizationId,
    plan_id: plan?.id ?? null,
    plan_code: planCode,
    status: "trialing" as const,
    trial_start: trialStart,
    trial_end: trialEnd,
    trial_ends_at: trialEnd,
    billing_cycle: billingInterval === "yearly" ? "yearly" : "monthly",
    billing_interval: billingInterval,
    current_period_start: trialStart,
    current_period_end: trialEnd,
    cancel_at_period_end: false,
    monthly_amount: definition.monthlyPrice,
    yearly_amount: definition.yearlyPrice,
    selected_modules: JSON.parse(JSON.stringify(getEnabledModulesForPlan(planCode))),
  };

  if (existingSub) {
    const { error: updateError } = await supabase
      .from("organization_subscriptions")
      .update(subscriptionPayload)
      .eq("id", existingSub.id);

    if (updateError) {
      return { error: `Erreur mise à jour abonnement: ${updateError.message}` };
    }
  } else {
    const { error: insertError } = await supabase
      .from("organization_subscriptions")
      .insert(subscriptionPayload);

    if (insertError) {
      return { error: `Erreur création abonnement: ${insertError.message}` };
    }
  }

  redirect("/bienvenue");
}
