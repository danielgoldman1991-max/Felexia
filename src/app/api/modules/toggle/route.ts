import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { organizationId, moduleKey, enabled } = await req.json();
    if (!organizationId || !moduleKey) {
      return NextResponse.json({ error: "organizationId et moduleKey requis" }, { status: 400 });
    }

    // Verify user is admin/owner of the organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role:roles(name)")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();

    const roleData = membership?.role;
    const roleName = Array.isArray(roleData)
      ? (roleData as { name: string }[])[0]?.name
      : roleData
        ? (roleData as unknown as { name: string }).name
        : null;
    if (!roleName || !["admin", "owner"].includes(roleName)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    if (enabled) {
      const { error } = await supabase
        .from("organization_modules")
        .upsert(
          { organization_id: organizationId, module_key: moduleKey, enabled: true },
          { onConflict: "organization_id, module_key" },
        );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("organization_modules")
        .delete()
        .eq("organization_id", organizationId)
        .eq("module_key", moduleKey);
      if (error) throw error;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
