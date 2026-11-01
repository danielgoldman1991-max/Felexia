// Config commerciale FelexiaERP.
// Source unique pour savoir quels plans sont commercialisés publiquement.
// PRO conserve le code historique "premium" pour les abonnements et Stripe.
// Business reste disponible uniquement pour les abonnements existants.

export const PUBLICLY_AVAILABLE_PLANS = ["essentiel", "premium"] as const;

export type PubliclyAvailablePlan = (typeof PUBLICLY_AVAILABLE_PLANS)[number];

/** Explicit public input mapping; unknown values must never fall back to Essentiel. */
export function resolvePublicPlanCode(planKey: unknown): PubliclyAvailablePlan | null {
  if (planKey === "pro") return "premium";
  return planKey === "essentiel" || planKey === "premium" ? planKey : null;
}

export function isPlanPubliclyAvailable(planKey: string | null | undefined): boolean {
  return resolvePublicPlanCode(planKey) !== null;
}

export function filterPubliclyAvailablePlans<T extends { code: string }>(
  plans: readonly T[],
): T[] {
  return plans.filter((plan) => isPlanPubliclyAvailable(plan.code));
}

export const PLAN_NOT_AVAILABLE_MESSAGE = "PLAN_NOT_AVAILABLE";
