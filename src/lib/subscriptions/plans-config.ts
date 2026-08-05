export const PLAN_KEYS = {
  ESSENTIEL: "essentiel",
  BUSINESS: "business",
  PREMIUM: "premium",
} as const;

export type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS];

export const DEFAULT_PLAN_KEY: PlanKey = PLAN_KEYS.ESSENTIEL;

export const PLAN_LABELS: Record<PlanKey, string> = {
  essentiel: "Essentiel",
  business: "Business",
  premium: "Premium",
};

export function normalizePlanKey(planKey: string | null | undefined): PlanKey {
  if (planKey === PLAN_KEYS.ESSENTIEL || planKey === PLAN_KEYS.BUSINESS || planKey === PLAN_KEYS.PREMIUM) {
    return planKey;
  }
  if (planKey === "pro") return PLAN_KEYS.PREMIUM;
  return DEFAULT_PLAN_KEY;
}