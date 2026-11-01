import type { ReactNode } from "react";
import { canManageHrWorkspace, requireHrWorkspace } from "@/lib/hr/access";

/** Server-rendered controls follow the same role and expiry policy as actions. */
export async function HrManagementAction({ children }: { children: ReactNode }) {
  const workspace = await requireHrWorkspace();
  return canManageHrWorkspace(workspace) ? children : null;
}
