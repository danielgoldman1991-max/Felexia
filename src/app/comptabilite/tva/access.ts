import type { ActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";

const managementRoles = new Set(["owner", "admin", "administrateur", "accountant", "comptable"]);

export function canWriteVatWorkspace(workspace: ActiveWorkspace): boolean {
  return canWriteProWorkspace(workspace)
    && managementRoles.has((workspace.role ?? "").toLowerCase());
}
