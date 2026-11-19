import { requireActiveWorkspace, type ActiveWorkspace } from "@/lib/auth";
import { isOperatorRole, isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription, SUBSCRIPTION_READ_ONLY_MESSAGE } from "@/lib/subscriptions/subscription-access";

const managementRoles = new Set(["owner", "admin", "administrateur", "accountant", "comptable"]);

/** Déclarations TVA et relevé SIMPL : ESSENTIEL et PRO, hors lecteur et opérateur. */
export function canWriteVatWorkspace(workspace: ActiveWorkspace): boolean {
  return !isReadOnlyRole(workspace.role)
    && !isOperatorRole(workspace.role)
    && canWriteWorkspaceSubscription(workspace.subscription)
    && managementRoles.has((workspace.role ?? "").toLowerCase());
}

export async function requireVatWorkspace() {
  const workspace = await requireActiveWorkspace({ module: "tva", level: "write" });
  if (!canWriteWorkspaceSubscription(workspace.subscription)) throw new Error(SUBSCRIPTION_READ_ONLY_MESSAGE);
  if (!canWriteVatWorkspace(workspace)) throw new Error("Votre rôle ne permet pas de modifier les déclarations TVA.");
  return workspace;
}
