import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEnv, hasServiceRoleKey } from "@/lib/env";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { email, roleId, organizationId } = await req.json();

    if (!email || !organizationId) {
      return NextResponse.json({ error: "Email et organisation requis" }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role_id, role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const role = Array.isArray(membership?.role)
      ? membership?.role[0]
      : membership?.role;

    if (!membership || role?.name !== "admin") {
      return NextResponse.json({ error: "Seul un administrateur peut inviter" }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Invitation deja envoyee" }, { status: 409 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("invitations").insert({
      organization_id: organizationId,
      email: email.toLowerCase(),
      role_id: roleId || null,
      invited_by: user.id,
      token,
      expires_at: expiresAt,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
