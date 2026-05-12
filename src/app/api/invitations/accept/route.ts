import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: invitation } = await supabase
      .from("invitations")
      .select("*, organization:organizations(name)")
      .eq("token", token)
       .eq("status", "pending")
      .single();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation invalide ou expiree" }, { status: 404 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
      return NextResponse.json({ error: "Invitation expiree" }, { status: 410 });
    }

    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
    });

    if (signUpError || !user) {
      return NextResponse.json({ error: signUpError?.message || "Erreur d'inscription" }, { status: 500 });
    }

    const serviceClient = createServiceClient();

    await serviceClient.from("profiles").upsert({
      id: user.id,
      email: invitation.email,
      full_name: invitation.email.split("@")[0],
    }, { onConflict: "id" });

    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("id", invitation.role_id)
      .maybeSingle();

    await serviceClient.from("organization_members").insert({
      organization_id: invitation.organization_id,
      user_id: user.id,
      role_id: role?.id || null,
      status: "active",
    });

    await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
