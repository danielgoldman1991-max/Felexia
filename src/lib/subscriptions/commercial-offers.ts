// Config commerciale FelexiaERP.
// Source unique pour savoir quels plans sont commercialisés publiquement.
// PRO conserve le code historique "premium" pour les abonnements et Stripe.
// Business reste disponible uniquement pour les abonnements existants.

export const PUBLICLY_AVAILABLE_PLANS = ["essentiel", "premium"] as const;
export const SELF_SERVICE_PLANS = ["essentiel"] as const;
export const PRO_QUOTE_REQUIRED = "PRO_QUOTE_REQUIRED";
export const PRO_QUOTE_REQUIRED_MESSAGE = "L’offre PRO est disponible sur devis. Contactez l’équipe Felexia pour préparer votre abonnement.";

export type PubliclyAvailablePlan = (typeof PUBLICLY_AVAILABLE_PLANS)[number];
export type SelfServicePlan = (typeof SELF_SERVICE_PLANS)[number];

export function isPlanQuoteOnly(planKey: unknown): boolean {
  return planKey === "pro" || planKey === "premium";
}

/** Display availability never authorizes a self-service subscription. */
export function resolveSelfServicePlanCode(planKey: unknown): SelfServicePlan | null {
  return planKey === "essentiel" ? "essentiel" : null;
}

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
