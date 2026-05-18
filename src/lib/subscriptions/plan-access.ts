import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import {
  DEFAULT_PLAN_CODE,
  DEFAULT_TRIAL_DAYS,
  getEnabledModulesForPlan,
  getPlanDefinition,
  normalizePlanCode,
  type PlanCode,
  type PlanFeatureKey,
  type PlanLimits,
} from "@/lib/subscriptions/plans";

export type OrganizationSubscription = {
  id: string;
  organizationId: string;
  planCode: PlanCode;
  status: string;
  billingCycle: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export function getPlanFeatures(planCode: string | null | undefined): PlanFeatureKey[] {
  return getPlanDefinition(planCode).features;
}

export function getPlanLimits(planCode: string | null | undefined): PlanLimits {
  return getPlanDefinition(planCode).limits;
}

export function canAccessFeature(planCode: string | null | undefined, featureKey: PlanFeatureKey): boolean {
  return getPlanFeatures(planCode).includes(featureKey);
}

export function canAccessModule(planCode: string | null | undefined, moduleKey: string): boolean {
  return getEnabledModulesForPlan(planCode).includes(moduleKey);
}

export async function getOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("*, plan:subscription_plans(code, slug)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as Record<string, unknown>;
  const plan = row.plan as { code?: string | null; slug?: string | null } | null;
  const planCode = normalizePlanCode((row.plan_code as string | null) ?? plan?.code ?? plan?.slug);

  return {
    id: row.id as string,
    organizationId: organizationId,
    planCode,
    status: (row.status as string | null) ?? "trialing",
    billingCycle: (row.billing_cycle as string | null) ?? (row.billing_interval as string | null) ?? "monthly",
    currentPeriodStart: (row.current_period_start as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    trialEndsAt: (row.trial_ends_at as string | null) ?? (row.trial_end as string | null) ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end ?? false),
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
  };
}

export async function ensureDefaultBusinessTrial(organizationId: string): Promise<void> {
  const supabase = await createClient();
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", DEFAULT_PLAN_CODE)
    .maybeSingle();

  const payload = {
    organization_id: organizationId,
    plan_id: (plan as { id?: string } | null)?.id ?? null,
    plan_code: DEFAULT_PLAN_CODE,
    status: "trialing",
    billing_cycle: "monthly",
    billing_interval: "monthly",
    trial_start: trialStart.toISOString(),
    trial_end: trialEnd.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    current_period_start: trialStart.toISOString(),
    current_period_end: trialEnd.toISOString(),
    cancel_at_period_end: false,
    monthly_amount: getPlanDefinition(DEFAULT_PLAN_CODE).monthlyPrice,
    yearly_amount: getPlanDefinition(DEFAULT_PLAN_CODE).yearlyPrice,
  };

  await supabase
    .from("organization_subscriptions")
    .upsert(payload, { onConflict: "organization_id" });
}

export async function canCreateUser(organizationId?: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const workspace = organizationId ? null : await requireActiveWorkspace();
  const orgId = organizationId ?? workspace!.organization.id;
  const subscription = await getOrganizationSubscription(orgId);
  const max = getPlanLimits(subscription?.planCode).users;

  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active");

  const current = count ?? 0;
  return { allowed: current < max, current, max };
}

export async function canCreateDocument(organizationId?: string): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const workspace = organizationId ? null : await requireActiveWorkspace();
  const orgId = organizationId ?? workspace!.organization.id;
  const subscription = await getOrganizationSubscription(orgId);
  const max = getPlanLimits(subscription?.planCode).commercialDocumentsPerMonth;

  if (max === null) {
    return { allowed: true, current: 0, max };
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const supabase = await createClient();
  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", monthStart);

  const current = count ?? 0;
  return { allowed: current < max, current, max };
}

export async function requirePlanFeature(featureKey: PlanFeatureKey): Promise<void> {
  const workspace = await requireActiveWorkspace();
  const planCode = workspace.subscription?.planCode ?? workspace.subscription?.planSlug ?? DEFAULT_PLAN_CODE;

  if (!canAccessFeature(planCode, featureKey)) {
    const { redirect } = await import("next/navigation");
    redirect("/parametres/abonnement");
  }
}

