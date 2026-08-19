import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultTrialAndModulesNoRevalidate } from "@/lib/subscriptions/plan-access";
import { getEnabledModulesForPlan } from "@/lib/subscriptions/plans";
import { DEFAULT_PLAN_KEY, type PlanKey } from "@/lib/subscriptions/plans-config";
import { redirect } from "next/navigation";

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

  // Garde : jamais d'appel d'abonnement/modules sans organisation valide.
  // L'utilisateur authentifié sans organisation est redirigé vers l'onboarding
  // (requireActiveWorkspace). La création du plan Essentiel reste limitée à
  // createEntrepriseAction — aucun fallback Business ici.
  if (!workspace.organization?.id) {
    redirect("/onboarding/entreprise");
  }

  if (!workspace.subscription) {
    const supabase = await createClient();
    try {
      await ensureDefaultTrialAndModulesNoRevalidate(supabase, workspace.organization.id, workspace.userId);
    } catch (err) {
      console.error(
        "[require-subscription] bootstrap default trial/modules failed, serving withDefaultTrial:",
        err,
      );
    }
    const refreshed = await requireActiveWorkspace();
    return refreshed.subscription ? refreshed : withDefaultTrial(workspace);
  }

  return workspace;
}