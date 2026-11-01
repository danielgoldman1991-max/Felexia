import "server-only";
import { requireActiveWorkspace, type ActiveWorkspace } from "@/lib/auth";
import { isOperatorRole, isReadOnlyRole } from "@/lib/auth/roles";
import { hasFullErpAccess } from "@/lib/launch-access";
import { canWriteWorkspaceSubscription, SUBSCRIPTION_READ_ONLY_MESSAGE } from "@/lib/subscriptions/subscription-access";

export const PRO_PLAN_REQUIRED_MESSAGE = "Cette fonctionnalité est incluse dans l’offre PRO. Retrouvez les offres dans Paramètres → Abonnement.";

/** Presentation policy for routes whose PRO entitlement is already checked. */
export function canWriteProWorkspace(workspace: ActiveWorkspace): boolean {
  return !isReadOnlyRole(workspace.role)
    && !isOperatorRole(workspace.role)
    && canWriteWorkspaceSubscription(workspace.subscription);
}

/** Check the current company before any advanced mutation, including storage. */
export async function requireProWorkspace({ write = true }: { write?: boolean } = {}) {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) {
    throw new Error(PRO_PLAN_REQUIRED_MESSAGE);
  }
  if (write) {
    if (!canWriteWorkspaceSubscription(workspace.subscription)) {
      throw new Error(SUBSCRIPTION_READ_ONLY_MESSAGE);
    }
    if (isReadOnlyRole(workspace.role) || isOperatorRole(workspace.role)) {
      throw new Error("Votre rôle ne permet pas de modifier les données de ce module PRO.");
    }
  }
  return workspace;
}
