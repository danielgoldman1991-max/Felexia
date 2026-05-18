import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PLAN_CODE, getEnabledModulesForPlan, normalizePlanCode, type PlanCode } from "@/lib/subscriptions/plans";

export type ActiveWorkspace = {
  userId: string;
  email: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: string | null;
  subscription: {
    status: string;
    planCode: PlanCode;
    planSlug: string;
  } | null;
  enabledModules: string[];
};

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function getCurrentUser() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getActiveWorkspace(): Promise<ActiveWorkspace | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: membership, error: membershipError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("organization_members")
        .select(
          "organization:organizations(id,name,slug), role:roles(name)",
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

  if (membershipError || !membership?.organization) {
    return null;
  }

  const organization = Array.isArray(membership.organization)
    ? membership.organization[0]
    : membership.organization;
  const role = Array.isArray(membership.role) ? membership.role[0] : membership.role;

  if (!organization) {
    return null;
  }

  let subscription: { status: string; planCode: PlanCode; planSlug: string } | null = null;
  try {
    const { data: sub } = await supabase
      .from("organization_subscriptions")
      .select("status, plan_code, plan:subscription_plans(code, slug)")
      .eq("organization_id", organization.id)
      .limit(1)
      .maybeSingle();
    if (sub) {
      const plan = sub.plan as unknown as { code?: string | null; slug?: string | null } | null;
      const planCode = normalizePlanCode(sub.plan_code ?? plan?.code ?? plan?.slug);
      subscription = {
        status: sub.status,
        planCode,
        planSlug: planCode,
      };
    }
  } catch {
    // Table doesn't exist yet (migration not applied)
  }

  const enabledModules = getEnabledModulesForPlan(subscription?.planCode ?? DEFAULT_PLAN_CODE);

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    organization,
    role: role?.name ?? null,
    subscription,
    enabledModules,
  };
}

export async function requireActiveWorkspace() {
  const workspace = await getActiveWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  return workspace;
}
