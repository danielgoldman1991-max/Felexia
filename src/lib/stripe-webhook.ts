/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStripe } from "@/lib/stripe";

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
    await processStripeEvent(event as any, supabase);
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
    case "checkout.session.completed": {
      await handleCheckoutCompleted(event.data.object, supabase);
      break;
    }
    case "invoice.paid": {
      await handleInvoicePaid(event.data.object, supabase);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await handleSubscriptionChanged(event.data.object, supabase);
      break;
    }
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

  const moduleKeysRaw = session.metadata?.module_keys;
  const isModuleBased = !!moduleKeysRaw;

  if (isModuleBased) {
    // Module-based subscription
    const moduleKeys: string[] = JSON.parse(moduleKeysRaw);
    const { data: catalog } = await supabase
      .from("modules_catalog")
      .select("*")
      .eq("is_active", true);

    const monthlyAmount = catalog
      ? catalog
          .filter((m) => moduleKeys.includes(m.module_key))
          .reduce((sum, m) => sum + Number(m.monthly_price), 0)
      : 0;

    const yearlyAmount = catalog
      ? catalog
          .filter((m) => moduleKeys.includes(m.module_key))
          .reduce((sum, m) => sum + Number(m.yearly_price), 0)
      : 0;

    // Enable organization_modules
    const moduleRows = moduleKeys.map((key: string) => ({
      organization_id: organizationId,
      module_key: key,
      enabled: true,
    }));

    await supabase
      .from("organization_modules")
      .upsert(moduleRows, { onConflict: "organization_id, module_key" });

    const interval = stripeSub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly";

    await supabase.from("organization_subscriptions").upsert({
      organization_id: organizationId,
      plan_id: null,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      status: stripeSub.status,
      billing_interval: interval,
      monthly_amount: monthlyAmount,
      yearly_amount: yearlyAmount,
      selected_modules: JSON.parse(JSON.stringify(moduleKeys)),
      current_period_start: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000).toISOString() : null,
      current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
      trial_start: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000).toISOString() : null,
      trial_end: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
    }, {
      onConflict: "organization_id",
    });
  } else {
    // Legacy plan-based subscription
    const planSlug = mapPriceToPlanSlug(stripeSub.items.data[0]?.price?.id);
    if (!planSlug) return;

    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("slug", planSlug)
      .single();

    if (!plan) return;

    await supabase.from("organization_subscriptions").upsert({
      organization_id: organizationId,
      plan_id: plan.id,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      status: stripeSub.status,
      billing_interval: stripeSub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
      current_period_start: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000).toISOString() : null,
      current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
      trial_start: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000).toISOString() : null,
      trial_end: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
    }, {
      onConflict: "organization_id",
    });
  }
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
    .update({ status: "active" })
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
    incomplete: "incomplete",
    incomplete_expired: "canceled",
  };

  const newStatus = statusMap[subscription.status] || "incomplete";

  await supabase
    .from("organization_subscriptions")
    .update({
      status: newStatus,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq("stripe_subscription_id", subscription.id);
}

const PRICE_TO_PLAN: Record<string, string> = {};

export function registerPriceMapping(priceId: string, planSlug: string): void {
  PRICE_TO_PLAN[priceId] = planSlug;
}

function mapPriceToPlanSlug(priceId?: string): string | null {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] || null;
}
