import { NextRequest, NextResponse } from "next/server";
import { generateTrialNotificationForOrg } from "@/lib/notifications/trial";
import { readAllPages } from "@/lib/listing";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[TRIAL_CRON] missing server credential");
    return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503, headers: NO_STORE });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401, headers: NO_STORE });
  }

  let generated = 0;
  try {
    const { createClient: createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();
    // Migration 069 enforces one row per company. Re-read the canonical row in
    // the shared generator as well, so a payment during the batch is respected.
    const candidates = await readAllPages<{ organization_id: string }>((from, to) => supabase
      .from("organization_subscriptions")
      .select("organization_id")
      .in("status", ["trialing", "past_due", "canceled", "unpaid"])
      .order("organization_id", { ascending: true })
      .range(from, to));
    const now = new Date();
    for (const organizationId of new Set(candidates.map(row => row.organization_id))) {
      const result = await generateTrialNotificationForOrg(organizationId, { client: supabase, now });
      if (result === "created") generated++;
    }
    return NextResponse.json({ generated }, { headers: NO_STORE });
  } catch {
    console.error("[TRIAL_CRON] notification batch failed", { generated });
    return NextResponse.json({ error: "Le traitement des notifications n'a pas pu être terminé.", generated }, { status: 503, headers: NO_STORE });
  }
}
