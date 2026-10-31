import type { ReactNode } from "react";
import { requireActiveWorkspace } from "@/lib/auth";
import { canAccessModule } from "@/lib/subscriptions/plan-access";
import { DEFAULT_PLAN_KEY, type PlanKey } from "@/lib/subscriptions/plans-config";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { hasFullErpAccess } from "@/lib/launch-access";
import { redirect } from "next/navigation";

export async function ModuleGuardLayout({
  children,
  moduleKey,
}: {
  children: ReactNode;
  moduleKey: string;
}) {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  if (!fullAccess && ["stock", "rh", "documents", "quotes"].includes(moduleKey)) {
    redirect("/parametres/modules");
  }
  const planCode: PlanKey = (workspace.subscription?.planCode as PlanKey | undefined) ?? DEFAULT_PLAN_KEY;

  if (!canAccessModule(planCode, moduleKey)) {
    return <ModuleUpgradePage />;
  }

  return <>{children}</>;
}
