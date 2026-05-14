import { createClient } from "@/lib/supabase/server";
import { cache } from "react";

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

// ── Get all available modules from catalog ────────────────────────────────────
export const getModulesCatalog = cache(async (): Promise<ModuleInfo[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("modules_catalog")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as ModuleInfo[];
});

// ── Get enabled modules for an organization ───────────────────────────────────
export async function getEnabledModules(
  organizationId: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_modules")
    .select("module_key")
    .eq("organization_id", organizationId)
    .eq("enabled", true);
  return (data ?? []).map((r) => r.module_key as string);
}

// ── Get subscription for an organization ──────────────────────────────────────
export async function getSubscription(
  organizationId: string,
): Promise<SubscriptionInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    status: row.status as string,
    billing_interval: (row.billing_interval as string) ?? null,
    trial_start: (row.trial_start as string) ?? null,
    trial_end: (row.trial_end as string) ?? null,
    current_period_start: (row.current_period_start as string) ?? null,
    current_period_end: (row.current_period_end as string) ?? null,
    monthly_amount: Number(row.monthly_amount ?? 0),
    yearly_amount: Number(row.yearly_amount ?? 0),
    selected_modules: Array.isArray(row.selected_modules)
      ? (row.selected_modules as string[])
      : [],
    stripe_customer_id: (row.stripe_customer_id as string) ?? null,
    stripe_subscription_id: (row.stripe_subscription_id as string) ?? null,
  };
}

// ── Check if subscription is valid (active or trialing) ───────────────────────
export function isSubscriptionValid(
  sub: SubscriptionInfo | null,
): boolean {
  if (!sub) return false;
  if (sub.status === "active") return true;
  if (sub.status === "trialing") {
    if (!sub.trial_end) return true;
    return new Date(sub.trial_end) > new Date();
  }
  return false;
}

// ── Require valid subscription (redirect if not) ──────────────────────────────
export async function requireValidSubscription(
  organizationId: string,
): Promise<SubscriptionInfo> {
  const sub = await getSubscription(organizationId);
  if (!isSubscriptionValid(sub)) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding/modules");
  }
  return sub!;
}

// ── Require module access (redirect if not) ──────────────────────────────────
export async function requireModuleAccess(
  organizationId: string,
  moduleKey: string,
): Promise<void> {
  const hasAccess = await canAccessModule(organizationId, moduleKey);
  if (!hasAccess) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding/modules");
  }
}

// ── Check if a specific module is accessible ──────────────────────────────────
export async function canAccessModule(
  organizationId: string,
  moduleKey: string,
): Promise<boolean> {
  const [modules, sub] = await Promise.all([
    getEnabledModules(organizationId),
    getSubscription(organizationId),
  ]);
  if (!isSubscriptionValid(sub)) return false;
  // Modules with price 0 are always available
  const catalog = await getModulesCatalog();
  const mod = catalog.find((m) => m.module_key === moduleKey);
  if (mod && mod.monthly_price === 0) return true;
  return modules.includes(moduleKey);
}

// ── Onboarding status ────────────────────────────────────────────────────────
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

  let hasSelectedModules = false;
  let hasValidSubscription = false;

  if (organizationId) {
    const [{ count: moduleCount }, sub] = await Promise.all([
      supabase
        .from("organization_modules")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      getSubscription(organizationId),
    ]);
    hasSelectedModules = (moduleCount ?? 0) > 0;
    hasValidSubscription = isSubscriptionValid(sub);
  }

  let nextPath: string;
  if (!hasOrganization) {
    nextPath = "/onboarding/entreprise";
  } else if (!hasSelectedModules) {
    nextPath = "/onboarding/modules";
  } else if (!hasValidSubscription) {
    nextPath = "/parametres/abonnement";
  } else {
    nextPath = "/dashboard";
  }

  return { hasOrganization, organizationId, hasSelectedModules, hasValidSubscription, nextPath };
}

// ── Calculate total from selected modules ─────────────────────────────────────
export function calculateModuleTotal(
  modules: ModuleInfo[],
  selectedKeys: string[],
  cycle: "monthly" | "yearly",
): number {
  return modules
    .filter((m) => selectedKeys.includes(m.module_key))
    .reduce((sum, m) => sum + (cycle === "monthly" ? Number(m.monthly_price) : Number(m.yearly_price)), 0);
}

// ── Trial end helper ──────────────────────────────────────────────────────────
export function getTrialDaysRemaining(trialEnd: string | null): number {
  if (!trialEnd) return 0;
  const end = new Date(trialEnd);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Check if trial is expired ─────────────────────────────────────────────────
export function isTrialExpired(sub: SubscriptionInfo | null): boolean {
  if (!sub || sub.status !== "trialing") return false;
  if (!sub.trial_end) return false;
  return new Date(sub.trial_end) <= new Date();
}
