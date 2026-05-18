import { requireActiveWorkspace } from "@/lib/auth";
import { canAccessModule, canCreateUser } from "@/lib/subscriptions/plan-access";
import { DEFAULT_PLAN_CODE } from "@/lib/subscriptions/plans";

export function planAllowsModule(planSlug: string, module: string): boolean {
  return canAccessModule(planSlug || DEFAULT_PLAN_CODE, module);
}

export async function requireModuleAccess(moduleCode: string): Promise<void> {
  const workspace = await requireActiveWorkspace();
  const planCode = workspace.subscription?.planCode ?? workspace.subscription?.planSlug ?? DEFAULT_PLAN_CODE;
  if (!canAccessModule(planCode, moduleCode)) {
    const { redirect } = await import("next/navigation");
    redirect("/parametres/abonnement");
  }
}

export async function checkUserLimit(): Promise<{ allowed: boolean; current: number; max: number }> {
  return canCreateUser();
}
