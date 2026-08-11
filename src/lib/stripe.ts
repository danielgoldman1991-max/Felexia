import Stripe from "stripe";
import { getEnv, hasStripeEnv } from "@/lib/env";
import { getPlanDefinition, normalizePlanCode, type PlanCode } from "@/lib/subscriptions/plans";
import { getStripePriceId } from "@/lib/subscriptions/stripe-prices";
import { isPlanPubliclyAvailable, PLAN_NOT_AVAILABLE_MESSAGE } from "@/lib/subscriptions/commercial-offers";

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
  });
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
  const stripe = getStripe();
  const env = getEnv();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { organization_id: organizationId },
    subscription_data: {
      metadata: { organization_id: organizationId },
    },
    success_url: successUrl || `${env.appUrl}/onboarding/paiement?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${env.appUrl}/parametres/abonnement?canceled=true`,
  });
  return session;
}

export function getStripePriceIdForPlan(planCode: string, billingCycle: "monthly" | "yearly"): string | null {
  return getStripePriceId(normalizePlanCode(planCode), billingCycle);
}

export async function createPlanCheckoutSession(
  customerId: string,
  planCode: PlanCode,
  priceId: string,
  organizationId: string,
  billingInterval: "monthly" | "yearly",
  successUrl?: string,
  cancelUrl?: string,
): Promise<Stripe.Checkout.Session> {
  // Protection commerciale serveur : Business / Premium ne sont plus
  // commercialisés. Personne ne doit pouvoir lancer un checkout pour ces
  // plans, même en modifiant le payload. (Les abonnements existants restent
  // gérés par Stripe via le portail et le webhook.)
  if (!isPlanPubliclyAvailable(planCode)) {
    throw new Error(PLAN_NOT_AVAILABLE_MESSAGE);
  }

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
  });
  return session;
}

export async function createModuleCheckoutSession(): Promise<Stripe.Checkout.Session> {
  throw new Error("La facturation par module est désactivée. Les modules sont inclus dans l'offre Essentiel.");
}

export async function createPortalSession(
  customerId: string,
  returnUrl?: string,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  const env = getEnv();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
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
