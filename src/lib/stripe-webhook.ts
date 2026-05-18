/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStripe } from "@/lib/stripe";
import { normalizePlanCode, type PlanCode } from "@/lib/subscriptions/plans";
import { getPlanCodeFromPriceId } from "@/lib/subscriptions/stripe-prices";

async function getServiceClient() {
  const { createClient: createServiceClient } = await import("@/lib/supabase/service");
  return createServiceClient();
}

export async function handleStripeWebhook(
  body: string,
  signature: string,
): Promise<{ received: boolean; type?: string }> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  const supabase = await getServiceClient();

  await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    data: event.data.object as unknown as Record<string, unknown>,
    processed: false,
  });

  try {
    await processStripeEvent(event, supabase);
    await supabase
      .from("stripe_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);
  } catch (err) {
    await supabase
      .from("stripe_events")
      .update({ error: (err as Error).message })
      .eq("stripe_event_id", event.id);
    throw err;
  }

  return { received: true, type: event.type };
}

async function processStripeEvent(
  event: any,
  supabase: Awaited<ReturnType<typeof getServiceClient>>,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, supabase);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object, supabase);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object, supabase);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChanged(event.data.object, supabase);
      break;
  }
}

async function handleCheckoutCompleted(
  session: any,
  supabase: Awaited<ReturnType<typeof getServiceClient>>,
): Promise<void> {
  const organizationId = session.metadata?.organization_id;
  if (!organizationId) return;

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;

  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;

  if (customerId) {
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", organizationId);
  }

  if (!subscriptionId) return;

  const stripe = getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId) as any;
  const priceId = stripeSub.items.data[0]?.price?.id as string | undefined;
  const planCode = normalizePlanCode(session.metadata?.plan_code ?? mapPriceToPlanCode(priceId));
  const interval = stripeSub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";

  await upsertSubscriptionFromStripe({
    supabase,
    organizationId,
    planCode,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId ?? null,
    stripeStatus: stripeSub.status,
    billingCycle: interval,
    currentPeriodStart: stripeSub.current_period_start,
    currentPeriodEnd: stripeSub.current_period_end,
    trialStart: stripeSub.trial_start,
    trialEnd: stripeSub.trial_end,
    cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
  });
}

async function handleInvoicePaid(
  invoice: any,
  supabase: Awaited<ReturnType<typeof getServiceClient>>,
): Promise<void> {
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription.id;

  await supabase
    .from("organization_subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
}

async function handleInvoicePaymentFailed(
  invoice: any,
  supabase: Awaited<ReturnType<typeof getServiceClient>>,
): Promise<void> {
  if (!invoice.subscription) return;

  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription.id;

  await supabase
    .from("organization_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
}

async function handleSubscriptionChanged(
  subscription: any,
  supabase: Awaited<ReturnType<typeof getServiceClient>>,
): Promise<void> {
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    trialing: "trialing",
    incomplete: "past_due",
    incomplete_expired: "canceled",
  };

  const priceId = subscription.items.data[0]?.price?.id as string | undefined;
  const planCode = normalizePlanCode(subscription.metadata?.plan_code ?? mapPriceToPlanCode(priceId));
  const organizationId = subscription.metadata?.organization_id;

  if (organizationId) {
    await upsertSubscriptionFromStripe({
      supabase,
      organizationId,
      planCode,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
      stripeStatus: statusMap[subscription.status] || "past_due",
      billingCycle: subscription.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });
    return;
  }

  await supabase
    .from("organization_subscriptions")
    .update({
      status: statusMap[subscription.status] || "past_due",
      plan_code: planCode,
      billing_cycle: subscription.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
      billing_interval: subscription.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
      current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
      current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

async function upsertSubscriptionFromStripe({
  supabase,
  organizationId,
  planCode,
  stripeSubscriptionId,
  stripeCustomerId,
  stripeStatus,
  billingCycle,
  currentPeriodStart,
  currentPeriodEnd,
  trialStart,
  trialEnd,
  cancelAtPeriodEnd,
}: {
  supabase: Awaited<ReturnType<typeof getServiceClient>>;
  organizationId: string;
  planCode: PlanCode;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  stripeStatus: string;
  billingCycle: "monthly" | "yearly";
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  trialStart?: number | null;
  trialEnd?: number | null;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", planCode)
    .maybeSingle();

  await supabase.from("organization_subscriptions").upsert({
    organization_id: organizationId,
    plan_id: plan?.id ?? null,
    plan_code: planCode,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_customer_id: stripeCustomerId,
    status: stripeStatus,
    billing_cycle: billingCycle,
    billing_interval: billingCycle,
    current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
    current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    trial_start: trialStart ? new Date(trialStart * 1000).toISOString() : null,
    trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
    trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
    cancel_at_period_end: cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "organization_id",
  });
}

export function registerPriceMapping(_priceId: string, _planSlug: string): void {
  void _priceId;
  void _planSlug;
  // Retained for older imports. Stripe plan mapping is now driven by env vars.
}

function mapPriceToPlanCode(priceId?: string): string | null {
  if (!priceId) return null;
  return getPlanCodeFromPriceId(priceId);
}
