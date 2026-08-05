import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultTrialAndModulesNoRevalidate } from "@/lib/subscriptions/plan-access";
import { getEnabledModulesForPlan } from "@/lib/subscriptions/plans";
import { DEFAULT_PLAN_KEY, type PlanKey } from "@/lib/subscriptions/plans-config";

function withDefaultTrial(workspace: Awaited<ReturnType<typeof requireActiveWorkspace>>) {
  const planKey: PlanKey = DEFAULT_PLAN_KEY;
  return {
    ...workspace,
    subscription: {
      status: "trialing",
      planCode: planKey,
      planSlug: planKey,
      trialStartedAt: new Date().toISOString(),
      trialEndsAt: null,
      currentPeriodEnd: null,
    },
    enabledModules: getEnabledModulesForPlan(planKey),
  };
}

export async function requireActiveSubscription() {
  const workspace = await requireActiveWorkspace();

  if (!workspace.subscription) {
    const supabase = await createClient();
    await ensureDefaultTrialAndModulesNoRevalidate(supabase, workspace.organization.id, workspace.userId);
    return withDefaultTrial(workspace);
  }

  return workspace;
}