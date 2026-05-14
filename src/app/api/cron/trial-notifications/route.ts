import { NextRequest, NextResponse } from "next/server";
import { buildTrialNotification } from "@/lib/notifications/trial";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { createClient: createServiceClient } = await import("@/lib/supabase/service");
  const supabase = await createServiceClient();

  // Find all organizations with trialing or past_due subscriptions
  const { data: orgs } = await supabase
    .from("organization_subscriptions")
    .select("organization_id, status, trial_end")
    .in("status", ["trialing", "past_due", "canceled"]);

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ generated: 0 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let generated = 0;

  for (const sub of orgs) {
    const trialEnd = sub.trial_end as string | null;
    const daysLeft = trialEnd
      ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    const notification = buildTrialNotification(sub.status as string, trialEnd, daysLeft);
    if (!notification) continue;

    // Dedup: check existing
    const { data: existing } = await supabase
      .from("app_notifications")
      .select("id")
      .eq("organization_id", sub.organization_id)
      .eq("type", notification.type)
      .gte("created_at", `${today}T00:00:00Z`)
      .lt("created_at", `${today}T23:59:59Z`)
      .limit(1);

    if (existing && existing.length > 0) continue;

    await supabase.from("app_notifications").insert({
      organization_id: sub.organization_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      action_label: notification.action_label,
      action_url: notification.action_url,
      severity: notification.severity,
      metadata: notification.metadata,
    });

    generated++;
  }

  return NextResponse.json({ generated });
}
