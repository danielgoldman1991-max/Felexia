import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PLAN_CODE,
  getEnabledModulesForPlan,
  getPlanDefinition,
  normalizePlanCode,
  SUBSCRIPTION_PLANS,
  type PlanCode,
} from "@/lib/subscriptions/plans";
import {
  enableBusinessModulesForOrganization,
  ensureBusinessTrialAndModulesNoRevalidate,
  getOrganizationSubscription,
  startBusinessTrialAndEnableModules,
} from "@/lib/subscriptions/plan-access";
import { canAccessApp } from "@/lib/subscriptions/subscription-access";

export type ModuleInfo = {
  module_key: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  sort_order: number;
};

export type SubscriptionInfo = {
  id: string;
  status: string;
  plan_code: PlanCode;
  billing_interval: string | null;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_amount: number;
  yearly_amount: number;
  selected_modules: string[];
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const MODULE_LABELS: Record<string, { name: string; description: string }> = {
  quotes: { name: "Ventes", description: "Devis, commandes clients et bons de livraison selon le pack." },
  invoicing: { name: "Facturation", description: "Factures, avoirs et paiements clients." },
  documents: { name: "Documents", description: "GED, imports, exports et pieces jointes." },
  crm: { name: "CRM", description: "Clients, prospects et pipeline commercial." },
  purchases: { name: "Achats", description: "Fournisseurs, commandes, receptions et factures fournisseurs." },
  stock: { name: "Stock", description: "Produits, mouvements, emplacements et alertes." },
  treasury: { name: "Tresorerie", description: "Comptes bancaires, caisses, mouvements et rapprochements." },
  accounting: { name: "Comptabilite", description: "Journaux, TVA, plan comptable et preparation comptable." },
  rh: { name: "Ressources humaines", description: "Employes, contrats, conges, paie et documents RH." },
  reports: { name: "Reporting", description: "Tableaux de bord avances et analyses." },
};

export const getModulesCatalog = cache(async (): Promise<ModuleInfo[]> => {
  const moduleKeys = Array.from(new Set(SUBSCRIPTION_PLANS.flatMap((plan) => plan.moduleKeys)));
  return moduleKeys.map((moduleKey, index) => ({
    module_key: moduleKey,
    name: MODULE_LABELS[moduleKey]?.name ?? moduleKey,
    description: MODULE_LABELS[moduleKey]?.description ?? null,
    monthly_price: 0,
    yearly_price: 0,
    sort_order: index + 1,
  }));
});

async function getStoredEnabledModules(organizationId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_modules")
    .select("module_key")
    .eq("organization_id", organizationId)
    .eq("enabled", true);

  if (error) return [];

  return data?.map((row) => row.module_key as string) ?? [];
}

export async function getEnabledModules(organizationId: string): Promise<string[]> {
  const sub = await getSubscription(organizationId);
  const storedModules = await getStoredEnabledModules(organizationId);
  return Array.from(new Set([
    ...getEnabledModulesForPlan(sub?.plan_code ?? DEFAULT_PLAN_CODE),
    ...storedModules,
  ]));
}

export async function getSubscription(organizationId: string): Promise<SubscriptionInfo | null> {
  const sub = await getOrganizationSubscription(organizationId);
  if (!sub) return null;

  const plan = getPlanDefinition(sub.planCode);
  return {
    id: sub.id,
    status: sub.status,
    plan_code: sub.planCode,
    billing_interval: sub.billingCycle,
    trial_start: null,
    trial_end: sub.trialEndsAt,
    current_period_start: sub.currentPeriodStart,
    current_period_end: sub.currentPeriodEnd,
    monthly_amount: plan.monthlyPrice,
    yearly_amount: plan.yearlyPrice,
    selected_modules: getEnabledModulesForPlan(sub.planCode),
    stripe_customer_id: sub.stripeCustomerId,
    stripe_subscription_id: sub.stripeSubscriptionId,
  };
}

export function isSubscriptionValid(sub: SubscriptionInfo | null): boolean {
  if (!sub) return false;
  return canAccessApp({
    status: sub.status as "trial" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | null,
    trial_ends_at: sub.trial_end,
    current_period_end: sub.current_period_end,
  });
}

export async function requireValidSubscription(organizationId: string): Promise<SubscriptionInfo> {
  let sub = await getSubscription(organizationId);
  if (!sub || !isSubscriptionValid(sub)) {
    const supabase = await createClient();
    await ensureBusinessTrialAndModulesNoRevalidate(supabase, organizationId);
    sub = await getSubscription(organizationId);
  }
  if (!isSubscriptionValid(sub)) {
    return {
      id: "business-trial-pending",
      status: "trialing",
      plan_code: DEFAULT_PLAN_CODE,
      billing_interval: "monthly",
      trial_start: null,
      trial_end: null,
      current_period_start: null,
      current_period_end: null,
      monthly_amount: getPlanDefinition(DEFAULT_PLAN_CODE).monthlyPrice,
      yearly_amount: getPlanDefinition(DEFAULT_PLAN_CODE).yearlyPrice,
      selected_modules: getEnabledModulesForPlan(DEFAULT_PLAN_CODE),
      stripe_customer_id: null,
      stripe_subscription_id: null,
    };
  }
  return sub!;
}

export async function requireModuleAccess(organizationId: string, moduleKey: string): Promise<void> {
  let sub = await getSubscription(organizationId);
  if (!sub || !isSubscriptionValid(sub)) {
    const supabase = await createClient();
    await ensureBusinessTrialAndModulesNoRevalidate(supabase, organizationId);
    sub = await getSubscription(organizationId);
  }
  const activeSubscription = sub!;
  if (!isSubscriptionValid(activeSubscription)) {
    return;
  }
  let enabledModules = await getEnabledModules(organizationId);
  if (!enabledModules.includes(moduleKey)) {
    const supabase = await createClient();
    await ensureBusinessTrialAndModulesNoRevalidate(supabase, organizationId);
    sub = await getSubscription(organizationId);
    enabledModules = await getEnabledModules(organizationId);
  }
  if (!sub || !enabledModules.includes(moduleKey)) {
    return;
  }
  await enableBusinessModulesForOrganization(organizationId);
}

export async function canAccessModule(organizationId: string, moduleKey: string): Promise<boolean> {
  const sub = await getSubscription(organizationId);
  if (!isSubscriptionValid(sub)) return false;
  return getEnabledModulesForPlan(sub?.plan_code ?? DEFAULT_PLAN_CODE).includes(moduleKey);
}

export type OnboardingStatus = {
  hasOrganization: boolean;
  organizationId: string | null;
  onboardingStep: string | null;
  onboardingCompleted: boolean;
  hasSelectedModules: boolean;
  hasValidSubscription: boolean;
  nextPath: string;
};

export async function getUserOnboardingStatus(): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      hasOrganization: false,
      organizationId: null,
      onboardingStep: null,
      onboardingCompleted: false,
      hasSelectedModules: false,
      hasValidSubscription: false,
      nextPath: "/login",
    };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organization:organizations(onboarding_step, onboarding_completed)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const hasOrganization = !!membership;
  const organizationId = membership?.organization_id ?? null;
  const organization = Array.isArray(membership?.organization)
    ? membership?.organization[0]
    : membership?.organization;
  const onboardingStep = (organization?.onboarding_step as string | null) ?? null;
  const onboardingCompleted = Boolean(organization?.onboarding_completed);
  let sub = organizationId ? await getSubscription(organizationId) : null;
  let hasValidSubscription = isSubscriptionValid(sub);

  if (organizationId && !hasValidSubscription) {
    await ensureBusinessTrialAndModulesNoRevalidate(supabase, organizationId, user.id);
    sub = await getSubscription(organizationId);
    hasValidSubscription = isSubscriptionValid(sub);
    await supabase
      .from("organizations")
      .update({
        onboarding_step: "completed",
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
  } else if (organizationId && hasValidSubscription && !onboardingCompleted) {
    await enableBusinessModulesForOrganization(organizationId);
    await supabase
      .from("organizations")
      .update({
        onboarding_step: "completed",
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
  }

  let nextPath = "/onboarding/entreprise";
  if (organizationId && onboardingCompleted) {
    nextPath = "/dashboard";
  } else if (organizationId && !sub) {
    nextPath = "/dashboard?trial_started=1";
  } else if (organizationId) {
    nextPath = "/dashboard";
  }

  return {
    hasOrganization,
    organizationId,
    onboardingStep,
    onboardingCompleted,
    hasSelectedModules: true,
    hasValidSubscription,
    nextPath,
  };
}

export async function startBusinessTrial(organizationId: string): Promise<void> {
  const supabase = await createClient();
  const completedAt = new Date().toISOString();
  await startBusinessTrialAndEnableModules(organizationId);

  await supabase
    .from("organizations")
    .update({
      onboarding_step: "completed",
      onboarding_completed: true,
      onboarding_completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", organizationId);
}

export function calculateModuleTotal(): number {
  return 0;
}

export function getTrialDaysRemaining(trialEnd: string | null): number {
  if (!trialEnd) return 0;
  const end = new Date(trialEnd);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function isTrialExpired(sub: SubscriptionInfo | null): boolean {
  if (!sub || sub.status !== "trialing") return false;
  if (!sub.trial_end) return false;
  return new Date(sub.trial_end) <= new Date();
}

export function coercePlanCode(planCode: string | null | undefined): PlanCode {
  return normalizePlanCode(planCode);
}
