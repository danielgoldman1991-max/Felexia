import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { id } = await params;
    const { roleId } = await req.json();

    if (!roleId) {
      return NextResponse.json({ error: "Role requis" }, { status: 400 });
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id, user_id, role:roles(name)")
      .eq("id", id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    const { data: adminMembership } = await supabase
      .from("organization_members")
      .select("role_id, role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", member.organization_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const adminRole = Array.isArray(adminMembership?.role)
      ? adminMembership?.role[0]
      : adminMembership?.role;

    if (!adminMembership || !ADMIN_ROLES.includes(adminRole?.name ?? "")) {
      return NextResponse.json(
        { error: "Seul un administrateur peut modifier les roles." },
        { status: 403 },
      );
    }

    const { data: newRole } = await supabase
      .from("roles")
      .select("name")
      .eq("id", roleId)
      .eq("organization_id", member.organization_id)
      .single();

    if (!newRole) {
      return NextResponse.json({ error: "Role invalide" }, { status: 400 });
    }

    const memberRole = Array.isArray(member.role)
      ? member.role[0]
      : member.role;

    const isRemovingAdmin = ADMIN_ROLES.includes(memberRole?.name ?? "") && !ADMIN_ROLES.includes(newRole.name);

    if (isRemovingAdmin) {
      const adminRoleIds = (
        await supabase
          .from("roles")
          .select("id")
          .eq("organization_id", member.organization_id)
          .in("name", ADMIN_ROLES)
      ).data ?? [];

      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", member.organization_id)
        .eq("status", "active")
        .in("role_id", adminRoleIds.map((r) => r.id));

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Impossible : l'organisation doit conserver au moins un administrateur actif." },
          { status: 403 },
        );
      }
    }

    if (member.user_id === user.id && !ADMIN_ROLES.includes(newRole.name)) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas retirer votre propre role d'administration." },
        { status: 403 },
      );
    }

    await supabase
      .from("organization_members")
      .update({ role_id: roleId, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
