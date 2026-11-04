import type { ActiveWorkspace } from "@/lib/auth";
import { canManageHrWorkspace } from "@/lib/hr/access";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export async function canWriteHrSettings(workspace: ActiveWorkspace) {
  const { modulePermissionDecision } = await import("@/lib/auth/module-permission");
  const decision = await modulePermissionDecision(workspace, "rh", "write");
  if (decision === "deny") return false;
  if (decision === "allow") return canWriteWorkspaceSubscription(workspace.subscription);
  return canManageHrWorkspace(workspace);
}
