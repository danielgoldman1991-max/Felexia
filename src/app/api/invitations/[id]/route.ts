import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    if (!membership || role?.name !== "admin") {
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
