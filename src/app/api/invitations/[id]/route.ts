import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";

import crypto from "crypto";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { id } = await params;

    const { data: invitation } = await supabase
      .from("invitations")
      .select("organization_id")
      .eq("id", id)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", invitation.organization_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const role = Array.isArray(membership?.role)
      ? membership?.role[0]
      : membership?.role;

    if (!membership || !ADMIN_ROLES.includes(role?.name ?? "")) {
      return NextResponse.json({ error: "Non autorise" }, { status: 403 });
    }

    await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { id } = await params;

    const { data: invitation } = await supabase
      .from("invitations")
      .select("organization_id, email, status")
      .eq("id", id)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }

    if (invitation.status !== "pending") {
      return NextResponse.json({ error: "Seules les invitations en attente peuvent etre renvoyees." }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", invitation.organization_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const role = Array.isArray(membership?.role)
      ? membership?.role[0]
      : membership?.role;

    if (!membership || !ADMIN_ROLES.includes(role?.name ?? "")) {
      return NextResponse.json({ error: "Non autorise" }, { status: 403 });
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("invitations")
      .update({
        token: newToken,
        expires_at: newExpiresAt,
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ success: true, token: newToken });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
