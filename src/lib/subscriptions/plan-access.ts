import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { BUSINESS_MODULE_KEYS } from "@/lib/business-modules";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { isSubscriptionUsable } from "@/lib/subscriptions/subscription-access";

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
    .limit(10);

  if (!data || data.length === 0) return null;

  const rows = data as Record<string, unknown>[];
  const row = rows.find((candidate) =>
    isSubscriptionUsable({
      status: candidate.status as string | null,
      trial_ends_at: (candidate.trial_ends_at as string | null) ?? (candidate.trial_end as string | null) ?? null,
      current_period_end: (candidate.current_period_end as string | null) ?? null,
    }),
  ) ?? rows[0];
  const planData = row.plan;
  const plan = Array.isArray(planData)
    ? planData[0] as { code?: string | null; slug?: string | null } | undefined
    : planData as { code?: string | null; slug?: string | null } | null;
  const planCode = normalizePlanCode(
    (row.plan_code as string | null) ??
    (row.plan_key as string | null) ??
    plan?.code ??
    plan?.slug,
  );

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
  await activateBusinessTrialForOrganization(organizationId);
}

export async function activateBusinessTrialForOrganization(
  organizationId: string,
  _userId?: string | null,
): Promise<void> {
  void _userId;
  const supabase = await createClient();
  await createDefaultBusinessTrial(supabase, organizationId);
}

export async function startBusinessTrialAndEnableModules(
  organizationId: string,
  userId?: string | null,
  client?: SupabaseClient,
): Promise<{ success: true }> {
  const supabase = client ?? await createClient();
  const result = await ensureBusinessTrialAndModulesNoRevalidate(supabase, organizationId, userId);

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/bienvenue");
  revalidatePath("/parametres/abonnement");

  return result;
}

export async function ensureBusinessTrialAndModulesNoRevalidate(
  supabase: SupabaseClient,
  organizationId: string,
  userId?: string | null,
): Promise<{ success: true }> {
  void userId;
  await createDefaultBusinessTrial(supabase, organizationId);
  await upsertBusinessModulesForOrganization(supabase, organizationId);

  return { success: true };
}

export async function createDefaultBusinessTrial(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const { data: existingSubscription, error: existingError } = await supabase
    .from("organization_subscriptions")
    .select("id, status, plan_code, trial_ends_at, trial_end, current_period_end")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Impossible de vérifier l'abonnement existant : ${existingError.message}`);
  }

  const existingStatus = String(existingSubscription?.status ?? "").toLowerCase();
  const rawExistingPlanCode = existingSubscription?.plan_code ?? null;
  const existingPlanCode = normalizePlanCode(rawExistingPlanCode);
  const existingIsUsable = isSubscriptionUsable({
    status: existingStatus,
    trial_ends_at: existingSubscription?.trial_ends_at ?? existingSubscription?.trial_end ?? null,
    current_period_end: existingSubscription?.current_period_end ?? null,
  });

  if (existingStatus === "active") {
    return;
  }

  if (existingIsUsable && rawExistingPlanCode && existingPlanCode === DEFAULT_PLAN_CODE) {
    return;
  }

  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", DEFAULT_PLAN_CODE)
    .maybeSingle();

  if (planError) {
    throw new Error(`Impossible de lire le plan Business : ${planError.message}`);
  }

  const payload = {
    organization_id: organizationId,
    plan_id: (plan as { id?: string } | null)?.id ?? null,
    plan_code: DEFAULT_PLAN_CODE,
    status: "trialing",
    billing_cycle: "monthly",
    billing_interval: "monthly",
    trial_started_at: trialStart.toISOString(),
    trial_start: trialStart.toISOString(),
    trial_end: trialEnd.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    trial_consent_accepted: true,
    trial_consent_accepted_at: trialStart.toISOString(),
    current_period_start: trialStart.toISOString(),
    current_period_end: trialEnd.toISOString(),
    cancel_at_period_end: false,
    monthly_amount: getPlanDefinition(DEFAULT_PLAN_CODE).monthlyPrice,
    yearly_amount: getPlanDefinition(DEFAULT_PLAN_CODE).yearlyPrice,
  };

  const { error } = existingSubscription?.id
    ? await supabase
        .from("organization_subscriptions")
        .update(payload)
        .eq("id", existingSubscription.id)
    : await supabase
        .from("organization_subscriptions")
        .insert({
          ...payload,
          created_at: trialStart.toISOString(),
        });

  if (error) {
    throw new Error(`Impossible d'activer l'essai gratuit Business : ${error.message}`);
  }
}

export async function enableBusinessModulesForOrganization(organizationId: string): Promise<void> {
  const supabase = await createClient();
  await upsertBusinessModulesForOrganization(supabase, organizationId);
}

export async function upsertBusinessModulesForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const moduleRows = BUSINESS_MODULE_KEYS.map((moduleKey) => ({
    organization_id: organizationId,
    module_key: moduleKey,
    enabled: true,
    created_at: now,
  }));

  if (moduleRows.length === 0) return;

  const { error } = await supabase
    .from("organization_modules")
    .upsert(moduleRows, { onConflict: "organization_id,module_key" });

  if (error) {
    throw new Error(`Impossible d'activer les modules Business : ${error.message}`);
  }
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
  void canAccessFeature(planCode, featureKey);
}
