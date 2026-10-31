import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteWorkspaceSubscription, SUBSCRIPTION_READ_ONLY_MESSAGE } from "@/lib/subscriptions/subscription-access";

/** Reading/exporting an existing company remains possible after expiry. */
export async function requireActiveSubscription() {
  return requireActiveWorkspace();
}

/** Mutations must also pass PostgreSQL's subscription guard (migration 099). */
export async function requireWritableSubscription() {
  const workspace = await requireActiveWorkspace();
  if (!canWriteWorkspaceSubscription(workspace.subscription)) {
    throw new Error(SUBSCRIPTION_READ_ONLY_MESSAGE);
  }
  return workspace;
}
