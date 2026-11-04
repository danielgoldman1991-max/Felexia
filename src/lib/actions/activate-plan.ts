"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { getEnabledModulesForPlan, getPlanDefinition, normalizePlanCode } from "@/lib/subscriptions/plans";
import { upsertModulesForPlan } from "@/lib/subscriptions/plan-modules";
import { resolveSelfServicePlanCode } from "@/lib/subscriptions/commercial-offers";
import type { PlanKey } from "@/lib/subscriptions/plans-config";

export type ActivatePlanState = {
  error: string | null;
};

export async function activatePlanAction(
  _prev: ActivatePlanState,
  formData: FormData,
): Promise<ActivatePlanState> {
  const planSlug = String(formData.get("planSlug") ?? formData.get("planCode") ?? "");
  const requestedOrganizationId = String(formData.get("organizationId") ?? "");
  const workspace = await requireActiveWorkspace();
  const { enforceModuleWrite } = await import("@/lib/auth/module-permission");
  const gate = await enforceModuleWrite(workspace, "parametres", isAdminRole(workspace.role));
  if (gate === "legacy") return { error: "Seul un administrateur de l'entreprise peut changer l'offre." };
  if (gate) return { error: gate };
  if (requestedOrganizationId && requestedOrganizationId !== workspace.organization.id) {
    return { error: "L'entreprise demandée ne correspond pas à la session." };
  }
  const selfServicePlan = resolveSelfServicePlanCode(planSlug);
  if (!selfServicePlan) {
    return { error: "Cette offre n'est pas activable depuis l'application. PRO se souscrit sur devis." };
  }

  const supabase = await createClient();
  const planCode = normalizePlanCode(selfServicePlan);
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
    organization_id: workspace.organization.id,
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

  await upsertModulesForPlan(supabase, workspace.organization.id, planCode as PlanKey);
  await logAudit(workspace.organization.id, "activate_plan", "organization_subscriptions", workspace.organization.id, { planCode });

  redirect("/dashboard");
}
