import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { roleId, permissionIds } = await req.json();

    if (!roleId || !Array.isArray(permissionIds)) {
      return NextResponse.json({ error: "roleId et permissionIds requis" }, { status: 400 });
    }

    const { data: role } = await supabase
      .from("roles")
      .select("organization_id")
      .eq("id", roleId)
      .single();

    if (!role) {
      return NextResponse.json({ error: "Role introuvable" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", role.organization_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const memberRole = Array.isArray(membership?.role)
      ? membership?.role[0]
      : membership?.role;

    if (!membership || memberRole?.name !== "admin") {
      return NextResponse.json({ error: "Non autorise" }, { status: 403 });
    }

    await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (permissionIds.length > 0) {
      const inserts = permissionIds.map((permissionId: string) => ({
        role_id: roleId,
        permission_id: permissionId,
      }));
      await supabase.from("role_permissions").insert(inserts);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
