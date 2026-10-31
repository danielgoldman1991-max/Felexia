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

    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, user_id, role:roles(name)")
      .eq("id", id)
      .single();
    if (memberError && memberError.code !== "PGRST116") return NextResponse.json({ error: "Impossible de charger ce membre. Réessayez." }, { status: 503 });

    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    const { data: adminMembership, error: adminError } = await supabase
      .from("organization_members")
      .select("role_id, role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", member.organization_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (adminError) return NextResponse.json({ error: "Impossible de vérifier vos droits. Réessayez." }, { status: 503 });

    const adminRole = Array.isArray(adminMembership?.role)
      ? adminMembership?.role[0]
      : adminMembership?.role;

    if (!adminMembership || !ADMIN_ROLES.includes(adminRole?.name ?? "")) {
      return NextResponse.json(
        { error: "Seul un administrateur peut modifier les roles." },
        { status: 403 },
      );
    }

    const { data: newRole, error: roleError } = await supabase
      .from("roles")
      .select("name")
      .eq("id", roleId)
      .eq("organization_id", member.organization_id)
      .single();
    if (roleError && roleError.code !== "PGRST116") return NextResponse.json({ error: "Impossible de vérifier ce rôle. Réessayez." }, { status: 503 });

    if (!newRole) {
      return NextResponse.json({ error: "Role invalide" }, { status: 400 });
    }

    const memberRole = Array.isArray(member.role)
      ? member.role[0]
      : member.role;

    const isRemovingAdmin = ADMIN_ROLES.includes(memberRole?.name ?? "") && !ADMIN_ROLES.includes(newRole.name);

    if (isRemovingAdmin) {
      const { data: adminRoleIds, error: rolesError } = await supabase
          .from("roles")
          .select("id")
          .eq("organization_id", member.organization_id)
          .in("name", ADMIN_ROLES);
      if (rolesError) return NextResponse.json({ error: "Impossible de vérifier les administrateurs. Réessayez." }, { status: 503 });

      const { count, error: countError } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", member.organization_id)
        .eq("status", "active")
        .in("role_id", (adminRoleIds ?? []).map((r) => r.id));
      if (countError || count === null) return NextResponse.json({ error: "Impossible de vérifier les administrateurs actifs. Réessayez." }, { status: 503 });

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

    const { data: updated, error: updateError } = await supabase
      .from("organization_members")
      .update({ role_id: roleId, updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", member.organization_id)
      .select("id").maybeSingle();
    if (updateError) return NextResponse.json({ error: "Le rôle n’a pas pu être enregistré. Actualisez puis réessayez." }, { status: updateError.code === "42501" ? 403 : 409 });
    if (!updated) return NextResponse.json({ error: "Ce membre n’a pas pu être modifié. Actualisez la liste." }, { status: 409 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
