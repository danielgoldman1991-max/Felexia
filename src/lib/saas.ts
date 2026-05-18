import { cache } from "react";
import { getOnboardingChecklist, isOnboardingChecklistComplete } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PLAN_CODE,
  getEnabledModulesForPlan,
  getPlanDefinition,
  normalizePlanCode,
  SUBSCRIPTION_PLANS,
  type PlanCode,
} from "@/lib/subscriptions/plans";
import { getOrganizationSubscription } from "@/lib/subscriptions/plan-access";

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

export async function getEnabledModules(organizationId: string): Promise<string[]> {
  const sub = await getSubscription(organizationId);
  return getEnabledModulesForPlan(sub?.plan_code ?? DEFAULT_PLAN_CODE);
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
  if (sub.status === "active") return true;
  if (sub.status === "trialing") {
    if (!sub.trial_end) return true;
    return new Date(sub.trial_end) > new Date();
  }
  return false;
}

export async function requireValidSubscription(organizationId: string): Promise<SubscriptionInfo> {
  const sub = await getSubscription(organizationId);
  if (!isSubscriptionValid(sub)) {
    const { redirect } = await import("next/navigation");
    redirect("/parametres/abonnement");
  }
  return sub!;
}

export async function requireModuleAccess(organizationId: string, moduleKey: string): Promise<void> {
  const hasAccess = await canAccessModule(organizationId, moduleKey);
  if (!hasAccess) {
    const { redirect } = await import("next/navigation");
    redirect("/parametres/abonnement");
  }
}

export async function canAccessModule(organizationId: string, moduleKey: string): Promise<boolean> {
  const sub = await getSubscription(organizationId);
  if (!isSubscriptionValid(sub)) return false;
  return getEnabledModulesForPlan(sub?.plan_code).includes(moduleKey);
}

export type OnboardingStatus = {
  hasOrganization: boolean;
  organizationId: string | null;
  hasSelectedModules: boolean;
  hasValidSubscription: boolean;
  nextPath: string;
};

export async function getUserOnboardingStatus(): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { hasOrganization: false, organizationId: null, hasSelectedModules: false, hasValidSubscription: false, nextPath: "/login" };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const hasOrganization = !!membership;
  const organizationId = membership?.organization_id ?? null;
  const sub = organizationId ? await getSubscription(organizationId) : null;
  const hasValidSubscription = isSubscriptionValid(sub);

  let nextPath = "/onboarding/entreprise";
  if (organizationId && !hasValidSubscription) {
    nextPath = "/parametres/abonnement";
  } else if (organizationId) {
    const checklist = await getOnboardingChecklist(organizationId);
    nextPath = isOnboardingChecklistComplete(checklist) ? "/dashboard" : "/bienvenue";
  }

  return {
    hasOrganization,
    organizationId,
    hasSelectedModules: true,
    hasValidSubscription,
    nextPath,
  };
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

