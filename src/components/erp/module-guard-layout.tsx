import type { ReactNode } from "react";
import { requireActiveWorkspace } from "@/lib/auth";
import { canAccessModule } from "@/lib/subscriptions/plan-access";
import { DEFAULT_PLAN_KEY, type PlanKey } from "@/lib/subscriptions/plans-config";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";

export async function ModuleGuardLayout({
  children,
  moduleKey,
}: {
  children: ReactNode;
  moduleKey: string;
}) {
  const workspace = await requireActiveWorkspace();
  const planCode: PlanKey = (workspace.subscription?.planCode as PlanKey | undefined) ?? DEFAULT_PLAN_KEY;

  if (!canAccessModule(planCode, moduleKey)) {
    return <ModuleUpgradePage />;
  }

  return <>{children}</>;
}