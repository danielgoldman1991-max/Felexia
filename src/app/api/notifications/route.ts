import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTrialNotificationForOrg, isCurrentTrialNotification, type TrialNotification } from "@/lib/notifications/trial";
import { getOrganizationSubscription } from "@/lib/subscriptions/plan-access";
import { readAllPages } from "@/lib/listing";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const sessionError = ["AuthSessionMissingError", "AuthInvalidJwtError"].includes(authError.name)
        || ["bad_jwt", "invalid_jwt", "no_authorization", "session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used", "user_not_found", "user_banned"].includes(authError.code ?? "")
        || authError.status === 401 || authError.status === 403;
      if (sessionError) return NextResponse.json({ error: "Non authentifié." }, { status: 401, headers: NO_STORE });
      throw new Error("NOTIFICATION_AUTH_UNAVAILABLE");
    }
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401, headers: NO_STORE });
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members").select("organization_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (membershipError) throw new Error("NOTIFICATION_MEMBERSHIP_UNAVAILABLE");
    if (!membership) return NextResponse.json({ error: "Aucune organisation active." }, { status: 400, headers: NO_STORE });

    const now = new Date();
    await generateTrialNotificationForOrg(membership.organization_id, { client: supabase, now });
    const sub = await getOrganizationSubscription(membership.organization_id, { client: supabase, throwOnError: true });
    const rows = await readAllPages<TrialNotification>((from, to) => supabase
      .from("app_notifications").select("*")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false }).order("id", { ascending: true })
      .range(from, to));
    const visible = rows.filter(notification => isCurrentTrialNotification(notification, sub, now));
    return NextResponse.json({ notifications: visible.slice(0, 50), total: visible.length }, { headers: NO_STORE });
  } catch {
    console.error("[notifications] load failed");
    return NextResponse.json({ error: "Impossible de charger les notifications. Réessayez dans quelques instants." }, { status: 503, headers: NO_STORE });
  }
}
