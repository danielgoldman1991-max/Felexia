/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStripe } from "@/lib/stripe";
import { normalizePlanCode } from "@/lib/subscriptions/plans";
import { getPlanCodeFromPriceId } from "@/lib/subscriptions/stripe-prices";

async function getServiceClient() {
  const { createClient } = await import("@/lib/supabase/service");
  return createClient();
}

type ServiceClient = Awaited<ReturnType<typeof getServiceClient>>;
function idOf(value: any): string | null {
  return typeof value === "string" ? value : typeof value?.id === "string" ? value.id : null;
}
function iso(seconds: unknown): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}
export function getInvoiceSubscriptionId(invoice: any): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription) ?? idOf(invoice.subscription);
}
export function getSubscriptionPeriods(subscription: any): { start: number | null; end: number | null } {
  const item = subscription.items?.data?.[0];
  return { start: item?.current_period_start ?? subscription.current_period_start ?? null, end: item?.current_period_end ?? subscription.current_period_end ?? null };
}
function requireWrite(result: { error: { code?: string } | null }, context: string) {
  if (result.error) {
    console.error("[stripe-webhook] persistence failed", { context, code: result.error.code });
    throw new Error("Stripe event could not be saved; retry required");
  }
}

export async function handleStripeWebhook(body: string, signature: string): Promise<{ received: boolean; type?: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Stripe webhook is unavailable");
  let event: any;
  try { event = getStripe().webhooks.constructEvent(body, signature, secret); }
  catch { throw new Error("Webhook signature verification failed"); }
  const service = await getServiceClient();
  const claim = await service.rpc("claim_stripe_event", { p_event_id: event.id, p_type: event.type, p_data: event.data.object });
  requireWrite(claim, "claim");
  if (claim.data === "processed") return { received: true, type: event.type };
  if (claim.data !== "claimed") throw new Error("Stripe event is already processing; retry required");
  try {
    await processEvent(event, service);
    const saved = await service.from("stripe_events").update({ processed: true, processed_at: new Date().toISOString(), processing_started_at: null, error: null }).eq("stripe_event_id", event.id).select("id").single();
    requireWrite(saved, "complete");
    if (!saved.data) throw new Error("Stripe event completion could not be confirmed");
  } catch (error) {
    // Preserve a retryable event. A crash after persistence is safe because the
    // billing RPC is itself idempotent and ignores stale/old-subscription events.
    const failed = await service.from("stripe_events").update({ processed: false, processing_started_at: null, error: "Processing failed; retry required" }).eq("stripe_event_id", event.id);
    if (failed.error) console.error("[stripe-webhook] failure marker could not be saved");
    throw error;
  }
  return { received: true, type: event.type };
}

async function processEvent(event: any, service: ServiceClient) {
  const object = event.data.object;
  let subscriptionId: string | null = null;
  let organizationId: string | null = null;
  switch (event.type) {
    case "checkout.session.completed":
      if (object.mode && object.mode !== "subscription") return;
      subscriptionId = idOf(object.subscription);
      organizationId = object.metadata?.organization_id ?? null;
      if (!organizationId) return; // Unrelated Stripe checkout.
      if (!subscriptionId) throw new Error("Stripe subscription is not yet available");
      break;
    case "invoice.paid":
    case "invoice.payment_failed":
      subscriptionId = getInvoiceSubscriptionId(object);
      if (!subscriptionId) return; // A one-off invoice has no subscription.
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.created":
      subscriptionId = object.id;
      break;
    default: return;
  }
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId!) as any;
  organizationId = organizationId ?? subscription.metadata?.organization_id ?? null;
  if (!organizationId) {
    const existing = await service.from("organization_subscriptions").select("organization_id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
    requireWrite(existing, "lookup");
    organizationId = existing.data?.organization_id ?? null;
  }
  if (!organizationId) return; // An external subscription not managed by Felexia.
  const periods = getSubscriptionPeriods(subscription);
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const rawPlan = (priceId && getPlanCodeFromPriceId(priceId)) || subscription.metadata?.plan_code;
  if (!["essentiel", "business", "premium"].includes(rawPlan)) throw new Error("Stripe plan mapping is unavailable");
  const status = ["active", "trialing", "past_due", "canceled", "unpaid", "incomplete"].includes(subscription.status)
    ? subscription.status : subscription.status === "incomplete_expired" ? "canceled" : "unpaid";
  if (["active", "trialing"].includes(status) && (!periods.start || !periods.end)) throw new Error("Stripe billing periods are unavailable");
  const payload = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: idOf(subscription.customer),
    plan_code: normalizePlanCode(rawPlan), status,
    billing_cycle: subscription.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
    current_period_start: iso(periods.start), current_period_end: iso(periods.end),
    trial_start: iso(subscription.trial_start), trial_end: iso(subscription.trial_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end), canceled_at: iso(subscription.canceled_at),
  };
  const saved = await service.rpc("apply_stripe_subscription", { p_organization_id: organizationId, p_payload: payload, p_event_created: Number(event.created ?? 0) });
  requireWrite(saved, "subscription");
}

/** Retained for old imports; current prices are resolved from server configuration. */
export function registerPriceMapping(_priceId: string, _planSlug: string): void { void _priceId; void _planSlug; }
