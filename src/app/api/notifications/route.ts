import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTrialNotificationForOrg } from "@/lib/notifications/trial";

export async function GET() {
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

  if (!membership) {
    return NextResponse.json({ error: "Aucune organisation active" }, { status: 400 });
  }

  // Generate trial notification if needed
  await generateTrialNotificationForOrg(membership.organization_id);

  const { data, count } = await supabase
    .from("app_notifications")
    .select("*", { count: "exact" })
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ notifications: data ?? [], total: count ?? 0 });
}
