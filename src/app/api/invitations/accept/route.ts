import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

type InvitationByToken = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  email: string;
  role_id: string | null;
  status: string;
  expires_at: string;
};

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: invitation } = (await supabase
      .rpc("get_invitation_by_token", { p_token: token })
      .maybeSingle()) as {
      data: InvitationByToken | null;
      error: { message: string } | null;
    };

    if (!invitation) {
      return NextResponse.json({ error: "Invitation invalide ou expiree" }, { status: 404 });
    }

    if (invitation.status !== "pending" || new Date(invitation.expires_at) < new Date()) {
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

    await serviceClient.from("organization_members").insert({
      organization_id: invitation.organization_id,
      user_id: user.id,
      role_id: invitation.role_id || null,
      status: "active",
    });

    const { error: acceptError } = await supabase.rpc("accept_invitation", { p_token: token });
    if (acceptError) {
      return NextResponse.json({ error: acceptError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
