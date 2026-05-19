import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessTrialAndModulesNoRevalidate } from "@/lib/subscriptions/plan-access";
import { canAccessApp, type SubscriptionStatus } from "@/lib/subscriptions/subscription-access";

const businessModules = ["quotes", "invoicing", "documents", "crm", "purchases", "stock", "treasury", "accounting"];

function withBusinessTrial(workspace: Awaited<ReturnType<typeof requireActiveWorkspace>>) {
  return {
    ...workspace,
    subscription: {
      status: "trialing",
      planCode: "business" as const,
      planSlug: "business",
      trialStartedAt: new Date().toISOString(),
      trialEndsAt: null,
      currentPeriodEnd: null,
    },
    enabledModules: businessModules,
  };
}

export async function requireActiveSubscription() {
  const workspace = await requireActiveWorkspace();

  if (!workspace.subscription) {
    const supabase = await createClient();
    await ensureBusinessTrialAndModulesNoRevalidate(supabase, workspace.organization.id, workspace.userId);
    return withBusinessTrial(workspace);
  }

  if (!canAccessApp({
    status: (workspace.subscription.status as SubscriptionStatus) ?? null,
    trial_ends_at: workspace.subscription.trialEndsAt,
    current_period_end: workspace.subscription.currentPeriodEnd,
  })) {
    const supabase = await createClient();
    await ensureBusinessTrialAndModulesNoRevalidate(supabase, workspace.organization.id, workspace.userId);
    return withBusinessTrial(workspace);
  }

  return workspace;
}
