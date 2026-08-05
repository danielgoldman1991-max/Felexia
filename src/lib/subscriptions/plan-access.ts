import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { upsertModulesForPlan } from "@/lib/subscriptions/plan-modules";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PLAN_CODE, getEnabledModulesForPlan, getPlanDefinition, normalizePlanCode, type PlanCode, type PlanFeatureKey, type PlanLimits } from "@/lib/subscriptions/plans";
import { PLAN_KEYS, type PlanKey } from "@/lib/subscriptions/plans-config";
import { isSubscriptionUsable } from "@/lib/subscriptions/subscription-access";
import { getBusinessTrialEndDate, getDefaultTrialEndDate } from "@/lib/subscriptions/trial-config";

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

const MODULE_KEY_ALIASES: Record<string, string> = {
  tiers: "crm",
  vente: "quotes",
  facturation: "invoicing",
  "facturation_paiements": "invoicing",
  articles: "products",
  achats: "purchases",
  tresorerie: "treasury",
  treasury: "treasury",
  inventory: "stock",
  comptabilite: "accounting",
  utilisateurs: "users",
  parametres: "settings",
  "guide_demarrage": "dashboard",
};

export function normalizeModuleKey(moduleKey: string): string {
  const alias = MODULE_KEY_ALIASES[moduleKey];
  return alias ?? moduleKey;
}

export function canAccessModule(planCode: string | null | undefined, moduleKey: string): boolean {
  return getEnabledModulesForPlan(planCode).includes(normalizeModuleKey(moduleKey));
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

async function upsertTrialForPlan(
  supabase: SupabaseClient,
  organizationId: string,
  planKey: PlanKey,
): Promise<void> {
  const trialStart = new Date();
  const trialEnd = planKey === PLAN_KEYS.BUSINESS
    ? getBusinessTrialEndDate(trialStart)
    : getDefaultTrialEndDate(trialStart);

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

  if (existingSubscription?.id) {
    return;
  }

  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", planKey)
    .maybeSingle();

  if (planError) {
    throw new Error(`Impossible de lire le plan ${planKey} : ${planError.message}`);
  }

  const payload = {
    organization_id: organizationId,
    plan_id: (plan as { id?: string } | null)?.id ?? null,
    plan_code: planKey,
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
    monthly_amount: getPlanDefinition(planKey).monthlyPrice,
    yearly_amount: getPlanDefinition(planKey).yearlyPrice,
    created_at: trialStart.toISOString(),
  };

  const { error } = await supabase.from("organization_subscriptions").insert(payload);

  if (error) {
    throw new Error(`Impossible d'activer l'essai gratuit ${planKey} : ${error.message}`);
  }
}

export async function ensureDefaultTrialAndModulesNoRevalidate(
  supabase: SupabaseClient,
  organizationId: string,
  userId?: string | null,
): Promise<{ success: true }> {
  void userId;
  await upsertTrialForPlan(supabase, organizationId, PLAN_KEYS.ESSENTIEL);
  await upsertModulesForPlan(supabase, organizationId, PLAN_KEYS.ESSENTIEL);

  return { success: true };
}

export async function startDefaultTrialAndEnableModules(
  organizationId: string,
  userId?: string | null,
  client?: SupabaseClient,
): Promise<{ success: true }> {
  const supabase = client ?? await createClient();
  const result = await ensureDefaultTrialAndModulesNoRevalidate(supabase, organizationId, userId);

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/bienvenue");
  revalidatePath("/parametres/abonnement");

  return result;
}

export async function enableModulesForOrganization(
  organizationId: string,
  planKey: PlanKey,
): Promise<void> {
  const supabase = await createClient();
  await upsertModulesForPlan(supabase, organizationId, planKey);
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
  await upsertTrialForPlan(supabase, organizationId, PLAN_KEYS.BUSINESS);
  await upsertModulesForPlan(supabase, organizationId, PLAN_KEYS.BUSINESS);

  return { success: true };
}

export async function createDefaultBusinessTrial(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await upsertTrialForPlan(supabase, organizationId, PLAN_KEYS.BUSINESS);
}

export async function enableBusinessModulesForOrganization(organizationId: string): Promise<void> {
  const supabase = await createClient();
  await upsertModulesForPlan(supabase, organizationId, PLAN_KEYS.BUSINESS);
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
