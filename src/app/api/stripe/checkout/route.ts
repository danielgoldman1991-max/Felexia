import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStripeCustomer, createCheckoutSession } from "@/lib/stripe";
import { hasStripeEnv } from "@/lib/env";

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

    const { priceId, billingInterval, planSlug } = await req.json();
    if (!priceId || !planSlug) {
      return NextResponse.json({ error: "priceId et planSlug requis" }, { status: 400 });
    }

    const interval = billingInterval === "yearly" ? "yearly" : "monthly";

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
    }

    const session = await createCheckoutSession(
      customerId,
      priceId,
      orgId,
      interval,
    );

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
