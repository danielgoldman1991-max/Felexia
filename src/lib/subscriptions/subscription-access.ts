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
} | null): boolean {
  if (!subscription) return false;

  const now = new Date();
  const status = String(subscription.status ?? "").toLowerCase();

  if (status === "active") return true;

  if (status === "past_due") {
    return true;
  }

  if (status === "trialing" || status === "trial") {
    const trialEnd = subscription.trial_ends_at ?? subscription.trial_end ?? null;
    if (!trialEnd) return true;
    return new Date(trialEnd).getTime() >= now.getTime();
  }

  return false;
}

export const isSubscriptionUsable = hasValidSubscriptionAccess;
export const hasValidSubscription = hasValidSubscriptionAccess;
export const canAccessApp = hasValidSubscriptionAccess;
