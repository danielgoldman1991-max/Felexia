import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeInvitationAction } from "@/lib/actions/complete-invitation";
import type { InvitationPreview } from "@/lib/auth/invitation-callback";

/** Legacy links require an already verified session. They never sign up or
 * attach somebody else's account merely because the caller knows a token. */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const { token, password } = (typeof body === "object" && body !== null ? body : {}) as {
      token?: unknown; password?: unknown;
    };
    if (typeof token !== "string" || !token || typeof password !== "string") {
      return NextResponse.json({ error: "Lien et mot de passe requis." }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email_confirmed_at) {
      return NextResponse.json({ error: "Demandez à votre administrateur de renvoyer l'invitation par email, puis validez son lien." }, { status: 401 });
    }
    const { data: invitation } = await supabase.rpc("get_invitation_by_token", { p_token: token }).maybeSingle<InvitationPreview>();
    if (!invitation) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({ error: "Cette invitation ne correspond pas à votre compte." }, { status: 403 });
    }
    const data = new FormData();
    data.set("invitationId", invitation.id);
    data.set("password", password);
    const result = await completeInvitationAction({ error: null }, data);
    return NextResponse.json(result.error ? result : { success: true }, { status: result.error ? 400 : 200 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
    console.error("[INVITE] legacy acceptance failed", error);
    return NextResponse.json({ error: "Impossible de finaliser cette invitation." }, { status: 500 });
  }
}
