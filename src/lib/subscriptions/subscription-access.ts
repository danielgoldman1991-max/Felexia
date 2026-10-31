export type SubscriptionStatus =
  | "trial"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | undefined
  | null;

export function hasValidSubscriptionAccess(subscription: {
  status?: SubscriptionStatus | string;
  trial_ends_at?: string | null;
  trial_end?: string | null;
  current_period_end?: string | null;
} | null, now = new Date()): boolean {
  if (!subscription) return false;

  const status = String(subscription.status ?? "").toLowerCase();

  if (status === "active") {
    const end = subscription.current_period_end;
    return Boolean(end && Number.isFinite(Date.parse(end)) && Date.parse(end) > now.getTime());
  }

  if (status === "trialing" || status === "trial") {
    const trialEnd = subscription.trial_ends_at ?? subscription.trial_end ?? null;
    return Boolean(trialEnd && Number.isFinite(Date.parse(trialEnd)) && Date.parse(trialEnd) > now.getTime());
  }

  return false;
}

export const isSubscriptionUsable = hasValidSubscriptionAccess;
export const hasValidSubscription = hasValidSubscriptionAccess;
export const canAccessApp = hasValidSubscriptionAccess;

export const SUBSCRIPTION_READ_ONLY_MESSAGE = "Votre espace est en consultation : votre essai ou abonnement doit être renouvelé avant de créer ou modifier des données.";

export function canWriteWorkspaceSubscription(subscription: {
  status?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
} | null, now = new Date()): boolean {
  return hasValidSubscriptionAccess(subscription ? {
    status: subscription.status,
    trial_ends_at: subscription.trialEndsAt,
    current_period_end: subscription.currentPeriodEnd,
  } : null, now);
}
