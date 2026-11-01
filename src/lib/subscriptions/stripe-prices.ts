import type { PlanCode } from "@/lib/subscriptions/plans";

type BillingCycle = "monthly" | "yearly";

/** Immutable historical production prices remain recognizable by reconciliation. */
const HISTORICAL_PRICE_TO_PLAN: Readonly<Record<string, PlanCode>> = {
  price_1TWLMYA1UYDHtMFw7TUgL7dI: "essentiel",
  price_1TYTQTA1UYDHtMFwCm6bSHuT: "essentiel",
};

const ENV_KEYS: Record<`${PlanCode}_${BillingCycle}`, string> = {
  essentiel_monthly: "STRIPE_PRICE_ESSENTIEL_MONTHLY",
  essentiel_yearly: "STRIPE_PRICE_ESSENTIEL_YEARLY",
  business_monthly: "STRIPE_PRICE_BUSINESS_MONTHLY",
  business_yearly: "STRIPE_PRICE_BUSINESS_YEARLY",
  premium_monthly: "STRIPE_PRICE_PREMIUM_MONTHLY",
  premium_yearly: "STRIPE_PRICE_PREMIUM_YEARLY",
};

/**
 * Maps a plan code + billing cycle to its Stripe Price ID from env vars.
 */
export function getStripePriceId(planCode: PlanCode, billingCycle: BillingCycle): string | null {
  const key = `${planCode}_${billingCycle}` as `${PlanCode}_${BillingCycle}`;
  return process.env[ENV_KEYS[key]] ?? null;
}

/**
 * PLAN_TO_STRIPE_PRICE: For each planCode, returns the monthly and yearly Stripe Price IDs.
 */
export const PLAN_TO_STRIPE_PRICE: Record<PlanCode, { monthly: string | null; yearly: string | null }> = {
  essentiel: {
    monthly: process.env.STRIPE_PRICE_ESSENTIEL_MONTHLY ?? null,
    yearly: process.env.STRIPE_PRICE_ESSENTIEL_YEARLY ?? null,
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? null,
    yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? null,
  },
  premium: {
    monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? null,
    yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY ?? null,
  },
};

/**
 * STRIPE_PRICE_TO_PLAN: reverse-maps any configured Stripe Price ID to its plan code.
 */
export function getPlanCodeFromPriceId(priceId: string): PlanCode | null {
  for (const [planCode, prices] of Object.entries(PLAN_TO_STRIPE_PRICE)) {
    if (prices.monthly === priceId || prices.yearly === priceId) {
      return planCode as PlanCode;
    }
  }
  return Object.prototype.hasOwnProperty.call(HISTORICAL_PRICE_TO_PLAN, priceId)
    ? HISTORICAL_PRICE_TO_PLAN[priceId]
    : null;
}

/**
 * Returns all configured Stripe Price IDs as a flat array (for lookup loops).
 */
export function getAllStripePriceIds(): string[] {
  return [...new Set([
    ...Object.values(PLAN_TO_STRIPE_PRICE).flatMap((p) => [p.monthly, p.yearly].filter(Boolean) as string[]),
    ...Object.keys(HISTORICAL_PRICE_TO_PLAN),
  ])];
}
