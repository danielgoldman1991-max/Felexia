import { canAccessApp, type SubscriptionStatus } from "@/lib/subscriptions/subscription-access";

export type OnboardingStep = "company" | "completed";

export type OnboardingSubscriptionState = {
  status?: SubscriptionStatus;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
} | null;

export function normalizeOnboardingStep(step: string | null | undefined): OnboardingStep {
  if (step === "company" || step === "completed") return step;
  return "completed";
}

export function resolveOnboardingRedirect({
  pathname,
  hasOrganization,
  subscription,
}: {
  pathname: string;
  hasOrganization: boolean;
  onboardingStep?: OnboardingStep | string | null;
  onboardingCompleted?: boolean | null;
  subscription?: OnboardingSubscriptionState;
}): string | null {
  if (!hasOrganization) {
    return pathname.startsWith("/onboarding/entreprise") ? null : "/onboarding/entreprise";
  }

  const hasAccess = canAccessApp(subscription ?? null);

  if (!hasAccess) {
    if (!pathname.startsWith("/parametres/abonnement")) {
      return "/parametres/abonnement";
    }
    return null;
  }

  return null;
}
