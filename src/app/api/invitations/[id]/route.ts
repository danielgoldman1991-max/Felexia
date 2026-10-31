import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { getActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { getAppUrl } from "@/lib/app-url";
import { mapInviteError, InvitationError, INVITATION_TTL_MS } from "@/lib/auth/invite-user";

async function loadInvitation(id: string) {
  const workspace = await getActiveWorkspace();
  if (!workspace) throw new InvitationError("UNAUTHENTICATED", "Non authentifié.", 401);
  if (!isAdminRole(workspace.role)) throw new InvitationError("FORBIDDEN", "Seul un administrateur peut gérer les invitations.", 403);
  const supabase = await createClient();
  const { data, error } = await supabase.from("invitations")
    .select("id, organization_id, email, role_id, full_name, status, expires_at, auth_user_id")
    .eq("id", id).eq("organization_id", workspace.organization.id).maybeSingle();
  if (error) throw new InvitationError("SUPABASE_UNKNOWN", "Impossible de charger cette invitation.", 500);
  return { invitation: data, workspace };
}

function errorResponse(error: unknown) {
  if (error instanceof InvitationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  console.error("[INVITE] lifecycle failed", error);
  return NextResponse.json({ error: "Impossible de gérer cette invitation." }, { status: 500 });
}

/** Revoke company access, never the person's global Supabase account. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { invitation, workspace } = await loadInvitation(id);
    if (!invitation) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.from("invitations")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", workspace.organization.id)
      .eq("status", "pending").select("id").maybeSingle();
    if (error) throw new InvitationError("SUPABASE_UNKNOWN", "Impossible de révoquer cette invitation.", 500);
    if (!data && invitation.status !== "revoked") {
      return NextResponse.json({ error: "Cette invitation a déjà été acceptée. Gérez le membre depuis la liste des utilisateurs." }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}

/** Rotate the local credential first; accepting/revoking uses the same row lock. */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { invitation, workspace } = await loadInvitation(id);
    if (!invitation) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
    if (invitation.status !== "pending") return NextResponse.json({ error: "Cette invitation n'est plus en attente." }, { status: 409 });
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Cette invitation a expiré. Révoquez-la puis créez-en une nouvelle." }, { status: 410 });
    }
    const serviceClient = createServiceClient();
    const { data: rotated, error: rotateError } = await serviceClient.from("invitations")
      .update({ token: crypto.randomBytes(32).toString("hex"),
        expires_at: new Date(Date.now() + INVITATION_TTL_MS).toISOString() })
      .eq("id", id).eq("organization_id", workspace.organization.id)
      .eq("status", "pending").select("id").maybeSingle();
    if (rotateError) throw new InvitationError("SUPABASE_UNKNOWN", "L'invitation n'a pas pu être préparée.", 500);
    if (!rotated) return NextResponse.json({ error: "L'invitation a été acceptée ou révoquée." }, { status: 409 });

    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(invitation.email, {
      redirectTo: `${getAppUrl()}/invitation?invitation=${id}`,
      data: { organization_id: invitation.organization_id, role_id: invitation.role_id,
        invitation_id: id, invited_by: workspace.userId, full_name: invitation.full_name },
    });
    if (error || !data.user) {
      console.error("[INVITE] resend failed", { id, code: error?.code, message: error?.message });
      throw mapInviteError(error ?? { message: "Invitation email unavailable" });
    }
    const { error: updateError } = await serviceClient.from("invitations")
      .update({ auth_user_id: data.user.id, invited_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", workspace.organization.id).eq("status", "pending");
    if (updateError) throw new InvitationError("SUPABASE_UNKNOWN", "L'email a été envoyé, mais sa confirmation est momentanément indisponible.", 500);
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}
