import "server-only";

import { requireActiveWorkspace, type ActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { canWriteWorkspaceSubscription, SUBSCRIPTION_READ_ONLY_MESSAGE } from "@/lib/subscriptions/subscription-access";

const managementRoles = new Set(["owner", "admin", "hr_manager", "accountant"]);

/** Used only after the server has checked access to the complete ERP. */
export function canManageHrWorkspace(workspace: ActiveWorkspace): boolean {
  return managementRoles.has(workspace.role ?? "") && canWriteWorkspaceSubscription(workspace.subscription);
}

/** Keep the complete company's existing records readable after expiry. */
export async function requireHrWorkspace(): Promise<ActiveWorkspace> {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) {
    throw new Error("Le module Ressources humaines est inclus dans l’offre PRO.");
  }
  const { moduleAccessErrorAny } = await import("@/lib/auth/module-permission");
  const denied = await moduleAccessErrorAny(workspace, ["rh", "paie"], "read");
  if (denied) throw new Error(denied);
  return workspace;
}

export async function requireWritableHrWorkspace(module: "rh" | "paie" = "rh"): Promise<ActiveWorkspace> {
  const workspace = await requireHrWorkspace();
  const { modulePermissionDecision } = await import("@/lib/auth/module-permission");
  const decision = await modulePermissionDecision(workspace, module, "write");
  if (decision === "deny") {
    throw new Error(module === "paie"
      ? "Votre rôle ne permet pas de modifier le module Paie."
      : "Votre rôle ne permet pas de modifier le module RH.");
  }
  if (decision !== "allow" && !managementRoles.has(workspace.role ?? "")) {
    throw new Error("Vous n'avez pas les droits nécessaires pour modifier le module RH.");
  }
  if (!canWriteWorkspaceSubscription(workspace.subscription)) {
    throw new Error(SUBSCRIPTION_READ_ONLY_MESSAGE);
  }
  return workspace;
}
