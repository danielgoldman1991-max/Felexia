import { requireActiveWorkspace } from "@/lib/auth";
import { canAccessModule, canCreateUser } from "@/lib/subscriptions/plan-access";
import { DEFAULT_PLAN_CODE } from "@/lib/subscriptions/plans";

export function planAllowsModule(planSlug: string, module: string): boolean {
  return canAccessModule(planSlug || DEFAULT_PLAN_CODE, module);
}

export async function requireModuleAccess(moduleCode: string): Promise<void> {
  const workspace = await requireActiveWorkspace();
  const planCode = workspace.subscription?.planCode ?? workspace.subscription?.planSlug ?? DEFAULT_PLAN_CODE;
  void canAccessModule(planCode, moduleCode);
}

export async function checkUserLimit(): Promise<{ allowed: boolean; current: number; max: number }> {
  return canCreateUser();
}
