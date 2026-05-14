import Stripe from "stripe";
import { getEnv, hasStripeEnv } from "@/lib/env";

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
    cancel_url: cancelUrl || `${env.appUrl}/onboarding/formule?canceled=true`,
  });
  return session;
}

export async function createModuleCheckoutSession(
  customerId: string,
  moduleKeys: string[],
  organizationId: string,
  billingInterval: "monthly" | "yearly",
  successUrl?: string,
  cancelUrl?: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const env = getEnv();
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: modules } = await supabase
    .from("modules_catalog")
    .select("module_key, stripe_monthly_price_id, stripe_yearly_price_id")
    .in("module_key", moduleKeys)
    .eq("is_active", true);

  if (!modules || modules.length === 0) {
    throw new Error("Aucun module trouvé");
  }

  const priceField = billingInterval === "yearly" ? "stripe_yearly_price_id" : "stripe_monthly_price_id";

  const lineItems = modules
    .filter((m) => m[priceField as keyof typeof m])
    .map((m) => ({
      price: m[priceField as keyof typeof m] as string,
      quantity: 1,
    }));

  if (lineItems.length === 0) {
    throw new Error("Aucun module avec Stripe price ID configuré");
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    metadata: {
      organization_id: organizationId,
      module_keys: JSON.stringify(moduleKeys),
    },
    subscription_data: {
      metadata: {
        organization_id: organizationId,
        module_keys: JSON.stringify(moduleKeys),
      },
    },
    success_url: successUrl || `${env.appUrl}/parametres/abonnement?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${env.appUrl}/parametres/abonnement?canceled=true`,
  });
  return session;
}

export async function createPortalSession(
  customerId: string,
  returnUrl?: string,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  const env = getEnv();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${env.appUrl}/parametres/facturation`,
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
