import Stripe from "stripe";
import { getEnv, hasStripeEnv } from "@/lib/env";
import { getPlanDefinition, type PlanCode } from "@/lib/subscriptions/plans";
import { getPlanCodeFromPriceId, getStripePriceId } from "@/lib/subscriptions/stripe-prices";
import { isPlanQuoteOnly, PLAN_NOT_AVAILABLE_MESSAGE, PRO_QUOTE_REQUIRED, resolveSelfServicePlanCode } from "@/lib/subscriptions/commercial-offers";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const env = getEnv();
  if (!hasStripeEnv()) {
    throw new Error("Stripe environment variables are not configured");
  }
  stripeInstance = new Stripe(env.stripeSecretKey);
  return stripeInstance;
}

export async function createStripeCustomer(
  email: string,
  name: string,
  organizationId: string,
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { organization_id: organizationId },
  }, { idempotencyKey: `felexia-customer-${organizationId}` });
  return customer;
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  organizationId: string,
  billingInterval: "monthly" | "yearly",
  successUrl?: string,
  cancelUrl?: string,
): Promise<Stripe.Checkout.Session> {
  const planCode = getPlanCodeFromPriceId(priceId);
  if (isPlanQuoteOnly(planCode)) throw new Error(PRO_QUOTE_REQUIRED);
  if (!planCode || !resolveSelfServicePlanCode(planCode)) throw new Error(PLAN_NOT_AVAILABLE_MESSAGE);
  const env = getEnv();
  return createPlanCheckoutSession(customerId, planCode, priceId, organizationId, billingInterval,
    successUrl || `${env.appUrl}/onboarding/paiement?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl || `${env.appUrl}/parametres/abonnement?canceled=true`);
}

export function getStripePriceIdForPlan(planCode: string, billingCycle: "monthly" | "yearly"): string | null {
  const selfServicePlan = resolveSelfServicePlanCode(planCode);
  return selfServicePlan ? getStripePriceId(selfServicePlan, billingCycle) : null;
}

/** A configured Price must charge exactly the advertised offer and cadence. */
export async function assertStripePriceMatchesPlan(
  priceId: string,
  planCode: PlanCode,
  billingInterval: "monthly" | "yearly",
): Promise<void> {
  if (isPlanQuoteOnly(planCode)) throw new Error(PRO_QUOTE_REQUIRED);
  if (!resolveSelfServicePlanCode(planCode) || getStripePriceIdForPlan(planCode, billingInterval) !== priceId) {
    throw new Error("BILLING_PRICE_MISMATCH");
  }
  const plan = getPlanDefinition(planCode);
  const expectedAmount = (billingInterval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) * 100;
  const price = await getStripe().prices.retrieve(priceId);
  if (!price.active || price.type !== "recurring" || price.billing_scheme !== "per_unit"
    || price.currency !== plan.currency.toLowerCase() || price.unit_amount !== expectedAmount
    || price.recurring?.interval !== (billingInterval === "yearly" ? "year" : "month")
    || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed"
    || price.transform_quantity !== null) {
    throw new Error("BILLING_PRICE_MISMATCH");
  }
}

export async function createPlanCheckoutSession(
  customerId: string,
  planCode: PlanCode,
  priceId: string,
  organizationId: string,
  billingInterval: "monthly" | "yearly",
  successUrl?: string,
  cancelUrl?: string,
  idempotencyKey?: string,
): Promise<Stripe.Checkout.Session> {
  // Quoted PRO contracts keep their durable legacy codes outside self-service.
  if (isPlanQuoteOnly(planCode)) throw new Error(PRO_QUOTE_REQUIRED);
  if (!resolveSelfServicePlanCode(planCode)) {
    throw new Error(PLAN_NOT_AVAILABLE_MESSAGE);
  }
  await assertStripePriceMatchesPlan(priceId, planCode, billingInterval);

  const stripe = getStripe();
  const env = getEnv();
  const plan = getPlanDefinition(planCode);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      organization_id: organizationId,
      plan_code: plan.code,
      billing_cycle: billingInterval,
    },
    subscription_data: {
      metadata: {
        organization_id: organizationId,
        plan_code: plan.code,
        billing_cycle: billingInterval,
      },
    },
    success_url: successUrl || `${env.appUrl}/parametres/abonnement?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${env.appUrl}/parametres/abonnement?canceled=true`,
  }, idempotencyKey ? { idempotencyKey } : undefined);
  return session;
}

export async function createModuleCheckoutSession(): Promise<Stripe.Checkout.Session> {
  throw new Error("La facturation par module est désactivée. Choisissez une offre Essentiel ou PRO.");
}

export async function createPortalSession(
  customerId: string,
  returnUrl?: string,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  const env = getEnv();
  const configuredId = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
  const configuration = configuredId
    ? await stripe.billingPortal.configurations.retrieve(configuredId, { expand: ["features.subscription_update.products"] })
    : (await stripe.billingPortal.configurations.list({ active: true, is_default: true, limit: 1, expand: ["data.features.subscription_update.products"] })).data[0];
  if (!configuration?.active) throw new Error("BILLING_PORTAL_UNAVAILABLE");
  const allowedPrices = new Set([getStripePriceId("essentiel", "monthly"), getStripePriceId("essentiel", "yearly")].filter(Boolean));
  const update = configuration.features.subscription_update;
  if (update.enabled && (!update.products?.length || update.products.some(product => product.prices.some(price => !allowedPrices.has(price))))) {
    throw new Error(PRO_QUOTE_REQUIRED);
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration: configuration.id,
    return_url: returnUrl || `${env.appUrl}/parametres/abonnement`,
  });
  return session;
}

export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
}
