// Config commerciale FelexiaERP.
// Source unique pour savoir quels plans sont commercialisés publiquement.
// Business / Premium restent techniquement en place (compatibilité avec les
// abonnements existants) mais ne sont NI visibles NI achetables pour le moment.

export const PUBLICLY_AVAILABLE_PLANS = ["essentiel"] as const;

export type PubliclyAvailablePlan = (typeof PUBLICLY_AVAILABLE_PLANS)[number];

export function isPlanPubliclyAvailable(
  planKey: string | null | undefined,
): boolean {
  if (!planKey) return false;
  return PUBLICLY_AVAILABLE_PLANS.includes(planKey as PubliclyAvailablePlan);
}

export function filterPubliclyAvailablePlans<T extends { code: string }>(
  plans: readonly T[],
): T[] {
  return plans.filter((plan) => isPlanPubliclyAvailable(plan.code));
}

export const PLAN_NOT_AVAILABLE_MESSAGE = "PLAN_NOT_AVAILABLE";
