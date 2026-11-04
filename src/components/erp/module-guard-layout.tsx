import type { ReactNode } from "react";
import { requireActiveWorkspace } from "@/lib/auth";
import { moduleAccessErrorAny } from "@/lib/auth/module-permission";
import type { ModuleKey } from "@/lib/auth/module-catalog";
import { canAccessModule } from "@/lib/subscriptions/plan-access";
import { DEFAULT_PLAN_KEY, type PlanKey } from "@/lib/subscriptions/plans-config";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { hasFullErpAccess } from "@/lib/launch-access";
import { redirect } from "next/navigation";

const MATRIX_READ: Record<string, ModuleKey[]> = {
  quotes: ["ventes"],
  invoicing: ["ventes"],
  purchases: ["achats"],
  stock: ["stock"],
  treasury: ["tresorerie"],
  accounting: ["comptabilite", "tva"],
  rh: ["rh", "paie"],
  crm: ["ventes", "achats"],
  documents: ["parametres", "ventes", "achats"],
  products: ["stock", "ventes", "achats"],
};

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

  const matrix = MATRIX_READ[moduleKey];
  if (matrix) {
    const denied = await moduleAccessErrorAny(workspace, matrix, "read");
    if (denied) {
      return <p className="mx-auto max-w-xl p-8 text-sm text-[var(--foreground)]">{denied}</p>;
    }
  }

  return <>{children}</>;
}
