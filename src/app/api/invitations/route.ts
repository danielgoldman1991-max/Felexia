import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";

import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const roleId = body.roleId ?? null;
    const organizationId = body.organizationId;
    const fullName = body.fullName ? String(body.fullName).trim() : null;

    if (!email || !organizationId) {
      return NextResponse.json({ error: "Email et organisation requis" }, { status: 400 });
    }

    if (!email.includes("@")) {
      return NextResponse.json({ error: "Format d'email invalide" }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const role = Array.isArray(membership?.role)
      ? membership?.role[0]
      : membership?.role;

    if (!membership || !ADMIN_ROLES.includes(role?.name ?? "")) {
      return NextResponse.json({ error: "Seul un administrateur peut inviter" }, { status: 403 });
    }

    const { data: matchingProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email);

    if (matchingProfiles && matchingProfiles.length > 0) {
      const matchingUserIds = matchingProfiles.map((p) => p.id);
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .in("user_id", matchingUserIds)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json(
          { error: "Cet utilisateur est deja membre de l'organisation." },
          { status: 409 },
        );
      }
    }

    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id, token")
      .eq("email", email)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json(
        { error: "Une invitation en attente existe deja pour cet email.", inviteLink: existingInvite.token },
        { status: 409 },
      );
    }

    if (roleId) {
      const { data: roleExists } = await supabase
        .from("roles")
        .select("id")
        .eq("id", roleId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!roleExists) {
        return NextResponse.json({ error: "Role invalide pour cette organisation." }, { status: 400 });
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      email,
      role_id: roleId || null,
      invited_by: user.id,
      token,
      expires_at: expiresAt,
    };

    try {
      const { data: test } = await supabase
        .from("invitations")
        .select("full_name")
        .limit(1);

      if (test !== null && test.length >= 0) {
        insertPayload.full_name = fullName ?? null;
      }
    } catch {
      // full_name column does not exist
    }

    const { error } = await supabase.from("invitations").insert(insertPayload);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const inviteLink = `${req.nextUrl.origin}/invitation?token=${token}`;

    return NextResponse.json({ success: true, inviteLink, token }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
