import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOperatorRole, OPERATOR_ACCESS_ERROR } from "@/lib/auth/operator-access";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role:roles(name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership?.organization_id) {
      return NextResponse.json({ error: "Aucune organisation active." }, { status: 400 });
    }

    const role = Array.isArray(membership.role) ? membership.role[0] : membership.role;
    if (isOperatorRole(role?.name)) {
      return NextResponse.json(
        { error: OPERATOR_ACCESS_ERROR, code: "OPERATOR_ACCESS_DENIED" },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("organizations")
      .update({
        onboarding_step: "completed",
        onboarding_completed: true,
        onboarding_completed_at: now,
        updated_at: now,
      })
      .eq("id", membership.organization_id);

    if (error) {
      return NextResponse.json(
        { error: "Impossible de terminer le guide de démarrage." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      redirectTo: "/dashboard?skipWelcome=1",
    });
  } catch (error) {
    console.error("complete-onboarding error", error);
    return NextResponse.json(
      { error: "Impossible de terminer le guide de démarrage pour le moment." },
      { status: 500 },
    );
  }
}
