import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPlanCheckoutSession, createStripeCustomer, getStripePriceIdForPlan } from "@/lib/stripe";
import { hasStripeEnv } from "@/lib/env";
import { normalizePlanCode } from "@/lib/subscriptions/plans";
import { isPlanPubliclyAvailable } from "@/lib/subscriptions/commercial-offers";

export async function POST(req: NextRequest) {
  try {
    if (!hasStripeEnv()) {
      return NextResponse.json({ error: "Stripe non configure" }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await req.json();
    const { billingInterval } = body;
    const planCode = normalizePlanCode(body.planCode);

    // Protection commerciale serveur : Business / Premium ne sont plus
    // achetables, même en modifiant l'URL ou le payload.
    if (!isPlanPubliclyAvailable(planCode)) {
      return NextResponse.json({ error: "PLAN_NOT_AVAILABLE" }, { status: 400 });
    }

    const interval = billingInterval === "yearly" ? "yearly" : "monthly";
    const priceId = getStripePriceIdForPlan(planCode, interval);

    if (!priceId) {
      const missingVar = `STRIPE_PRICE_${planCode.toUpperCase()}_${interval.toUpperCase()}`;
      return NextResponse.json(
        { error: `Variable d'environnement manquante : ${missingVar}. Ajoutez-la dans Vercel > Settings > Environment Variables.` },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership?.organization_id) {
      return NextResponse.json({ error: "Aucune organisation active" }, { status: 400 });
    }

    const orgId = membership.organization_id;

    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const orgName = orgData?.name ?? null;

    const { data: existingCust } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .single();

    let customerId = existingCust?.stripe_customer_id;

    if (!customerId) {
      const customer = await createStripeCustomer(
        user.email,
        profile?.full_name || orgName || orgId,
        orgId,
      );
      customerId = customer.id;
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId);
    }

    const session = await createPlanCheckoutSession(
      customerId,
      planCode,
      priceId,
      orgId,
      interval,
    );

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
