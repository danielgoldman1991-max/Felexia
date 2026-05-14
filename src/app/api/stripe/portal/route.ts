import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/lib/stripe";
import { hasStripeEnv } from "@/lib/env";

export async function POST() {
  try {
    if (!hasStripeEnv()) {
      return NextResponse.json({ error: "Stripe non configure" }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

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

    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", membership.organization_id)
      .single();

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: "Aucun client Stripe" }, { status: 400 });
    }

    const session = await createPortalSession(org.stripe_customer_id);
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
