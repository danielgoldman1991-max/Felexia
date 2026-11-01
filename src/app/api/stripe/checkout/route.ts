import { NextRequest, NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { assertStripePriceMatchesPlan, createPlanCheckoutSession, createStripeCustomer, createPortalSession, getStripePriceIdForPlan, getStripe } from "@/lib/stripe";
import { hasStripeEnv } from "@/lib/env";
import { resolvePublicPlanCode } from "@/lib/subscriptions/commercial-offers";
import { isAdminRole, isOperatorRole } from "@/lib/auth/roles";
import { OPERATOR_ACCESS_ERROR } from "@/lib/auth/operator-access";
import { hasProWriteCapabilities } from "@/lib/pro-capabilities";

export async function POST(req: NextRequest) {
  let lease: string | null = null;
  let organizationId: string | null = null;
  try {
    const workspace = await getActiveWorkspace();
    if (!workspace) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    if (!isAdminRole(workspace.role)) return NextResponse.json({ error: isOperatorRole(workspace.role) ? OPERATOR_ACCESS_ERROR : "Seul un administrateur peut gérer l'abonnement.", code: isOperatorRole(workspace.role) ? "OPERATOR_ACCESS_DENIED" : "BILLING_ADMIN_REQUIRED" }, { status: 403 });
    if (!hasStripeEnv()) return NextResponse.json({ error: "La souscription est momentanément indisponible. Contactez l'assistance." }, { status: 503 });
    const body = await req.json().catch(() => null);
    const planCode = resolvePublicPlanCode(body?.planCode);
    if (!planCode) return NextResponse.json({ error: "PLAN_NOT_AVAILABLE" }, { status: 400 });
    if (body.billingInterval !== "monthly" && body.billingInterval !== "yearly") return NextResponse.json({ error: "Choisissez une périodicité valide." }, { status: 400 });
    const interval = body.billingInterval as "monthly" | "yearly";
    if (planCode === "premium" && !(await hasProWriteCapabilities(workspace.organization.id))) {
      return NextResponse.json({ error: "Activation PRO en cours. L’offre sera disponible dès la fin de sa préparation. Aucun paiement n’a été lancé.", code: "PRO_ACTIVATION_PENDING" }, { status: 503 });
    }
    const priceId = getStripePriceIdForPlan(planCode, interval);
    if (!priceId) return NextResponse.json({ error: "Ce tarif est momentanément indisponible. Contactez l'assistance." }, { status: 503 });
    await assertStripePriceMatchesPlan(priceId, planCode, interval);
    organizationId = workspace.organization.id;
    const service = createServiceClient();
    const claimed = await service.rpc("claim_billing_checkout", { p_organization_id: organizationId });
    if (claimed.error) throw new Error("CHECKOUT_RESERVATION_FAILED");
    if (!claimed.data) return NextResponse.json({ error: "Une souscription est déjà en cours de préparation. Réessayez dans quelques instants." }, { status: 409 });
    lease = String(claimed.data);
    const { data: org, error: orgError } = await service.from("organizations").select("stripe_customer_id,name").eq("id", organizationId).single();
    if (orgError || !org) throw new Error("BILLING_COMPANY_UNAVAILABLE");
    const stripe = getStripe();
    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      if (!workspace.email) throw new Error("BILLING_EMAIL_REQUIRED");
      const customer = await createStripeCustomer(workspace.email, org.name || workspace.organization.name, organizationId);
      customerId = customer.id;
      const saved = await service.from("organizations").update({ stripe_customer_id: customerId }).eq("id", organizationId);
      if (saved.error) throw new Error("BILLING_CUSTOMER_SAVE_FAILED");
    } else {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted || customer.metadata.organization_id !== organizationId) throw new Error("BILLING_CUSTOMER_MISMATCH");
    }
    // An existing subscription is changed/recovered through the portal. Never
    // start a second recurring charge when a cycle or payment method changes.
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (subscriptions.has_more) throw new Error("BILLING_REVIEW_REQUIRED");
    if (subscriptions.data.some(sub => !["canceled", "incomplete_expired"].includes(sub.status))) {
      const portal = await createPortalSession(customerId);
      return NextResponse.json({ url: portal.url, destination: "portal" });
    }
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    if (sessions.has_more) throw new Error("BILLING_REVIEW_REQUIRED");
    for (const open of sessions.data.filter(session => session.mode === "subscription")) {
      if (open.metadata?.organization_id !== organizationId) throw new Error("BILLING_CUSTOMER_MISMATCH");
      if (open.metadata.plan_code === planCode && open.metadata.billing_cycle === interval && open.url) {
        const items = await stripe.checkout.sessions.listLineItems(open.id, { limit: 2 });
        if (!items.has_more && items.data.length === 1 && items.data[0].quantity === 1 && items.data[0].price?.id === priceId) {
          return NextResponse.json({ url: open.url, destination: "checkout" });
        }
      }
      await stripe.checkout.sessions.expire(open.id);
    }
    const session = await createPlanCheckoutSession(customerId, planCode, priceId, organizationId, interval, undefined, undefined, `felexia-checkout-${lease}`);
    return NextResponse.json({ url: session.url, destination: "checkout" });
  } catch {
    console.error("[billing] checkout preparation failed", { organizationId });
    return NextResponse.json({ error: "La souscription n'a pas pu être préparée. Aucun paiement n'a été lancé. Réessayez ou contactez l'assistance." }, { status: 503 });
  } finally {
    if (lease && organizationId) {
      const released = await createServiceClient().rpc("release_billing_checkout", { p_organization_id: organizationId, p_lease_token: lease });
      if (released.error) console.error("[billing] checkout lease release failed", { organizationId });
    }
  }
}
