import type { ReactNode } from "react";
import { requireActiveWorkspace } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/saas";

export async function ModuleGuardLayout({
  children,
  moduleKey,
}: {
  children: ReactNode;
  moduleKey: string;
}) {
  const workspace = await requireActiveWorkspace();
  await requireModuleAccess(workspace.organization.id, moduleKey);
  return <>{children}</>;
}
