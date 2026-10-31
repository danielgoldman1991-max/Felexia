import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";

async function checkAdminAuth(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifie", status: 401 };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role_id, role:roles(name)")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (membershipError) return { error: "Impossible de vérifier vos droits. Réessayez.", status: 503 };

  const role = Array.isArray(membership?.role)
    ? membership?.role[0]
    : membership?.role;

  if (!membership || !ADMIN_ROLES.includes(role?.name ?? "")) {
    return { error: "Seul un administrateur peut effectuer cette action.", status: 403 };
  }

  return { user, membership, role: role?.name ?? null };
}

async function getAdminRoleIds(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data, error } = await supabase
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .in("name", ADMIN_ROLES);
  if (error) throw new Error("Impossible de vérifier les administrateurs de l’entreprise.");
  return (data ?? []).map((r) => r.id);
}

async function isLastActiveAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberId: string,
  memberOrganizationId: string,
): Promise<boolean> {
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("role_id, role:roles(name)")
    .eq("id", memberId)
    .eq("organization_id", memberOrganizationId)
    .single();
  if (memberError || !member) throw new Error("Impossible de vérifier ce membre.");

  const memberRole = Array.isArray(member?.role)
    ? member?.role[0]
    : member?.role;

  if (!ADMIN_ROLES.includes(memberRole?.name ?? "")) return false;

  const adminRoleIds = await getAdminRoleIds(supabase, memberOrganizationId);

  const { count, error: countError } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", memberOrganizationId)
    .eq("status", "active")
    .in("role_id", adminRoleIds);
  if (countError || count === null) throw new Error("Impossible de vérifier les administrateurs actifs.");

  return (count ?? 0) <= 1;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, user_id")
      .eq("id", id)
      .single();
    if (memberError && memberError.code !== "PGRST116") return NextResponse.json({ error: "Impossible de charger ce membre. Réessayez." }, { status: 503 });

    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    const auth = await checkAdminAuth(supabase, member.organization_id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (member.user_id === (auth as { user: { id: string } }).user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte de cette organisation." },
        { status: 403 },
      );
    }

    if (await isLastActiveAdmin(supabase, id, member.organization_id)) {
      return NextResponse.json(
        { error: "Impossible : l'organisation doit conserver au moins un administrateur actif." },
        { status: 403 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("organization_members")
      .update({ status: "disabled", updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", member.organization_id)
      .select("id").maybeSingle();
    if (updateError) return NextResponse.json({ error: "La désactivation n’a pas pu être enregistrée. Actualisez puis réessayez." }, { status: updateError.code === "42501" ? 403 : 409 });
    if (!updated) return NextResponse.json({ error: "Ce membre n’a pas pu être modifié. Actualisez la liste." }, { status: 409 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const { status: newStatus } = await req.json();

    if (newStatus !== "active" && newStatus !== "disabled") {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, user_id")
      .eq("id", id)
      .single();
    if (memberError && memberError.code !== "PGRST116") return NextResponse.json({ error: "Impossible de charger ce membre. Réessayez." }, { status: 503 });

    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    const auth = await checkAdminAuth(supabase, member.organization_id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (newStatus === "disabled" && member.user_id === (auth as { user: { id: string } }).user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas désactiver votre propre compte." },
        { status: 403 },
      );
    }

    if (newStatus === "disabled" && await isLastActiveAdmin(supabase, id, member.organization_id)) {
      return NextResponse.json(
        { error: "Impossible : l'organisation doit conserver au moins un administrateur actif." },
        { status: 403 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("organization_members")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", member.organization_id)
      .select("id").maybeSingle();
    if (updateError) return NextResponse.json({ error: "Le statut n’a pas pu être enregistré. Actualisez puis réessayez." }, { status: updateError.code === "42501" ? 403 : 409 });
    if (!updated) return NextResponse.json({ error: "Ce membre n’a pas pu être modifié. Actualisez la liste." }, { status: 409 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
