import "server-only";
import crypto from "node:crypto";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { isAdminRole } from "@/lib/auth/roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_EMAIL" | "INVALID_ROLE"
  | "MEMBER_EXISTS" | "INVITE_PENDING" | "USER_LIMIT" | "AUTH_USER_EXISTS"
  | "EMAIL_PROVIDER_DISABLED" | "EMAIL_RATE_LIMIT" | "EMAIL_NOT_AUTHORIZED"
  | "EMAIL_SMTP_FAILED" | "SUPABASE_UNKNOWN";

export class InvitationError extends Error {
  constructor(readonly code: InvitationErrorCode, message: string, readonly status: number) {
    super(message);
    this.name = "InvitationError";
  }
}

export function mapInviteError(error: { code?: string | null; message: string }): InvitationError {
  const code = error.code ?? "";
  const lower = error.message.toLowerCase();
  if (code === "email_provider_disabled" || lower.includes("email provider disabled")) {
    return new InvitationError("EMAIL_PROVIDER_DISABLED", "L'envoi des emails est momentanément indisponible. Contactez l'assistance.", 503);
  }
  if (code === "over_email_send_rate_limit" || lower.includes("rate limit")) {
    return new InvitationError("EMAIL_RATE_LIMIT", "Limite d'envoi d'emails atteinte. Réessayez dans quelques minutes.", 429);
  }
  if (code === "email_address_not_authorized" || lower.includes("not authorized") || lower.includes("not allowed")) {
    return new InvitationError("EMAIL_NOT_AUTHORIZED", "Le service email n'autorise pas encore cette adresse. Contactez l'assistance.", 400);
  }
  if (["user_already_exists", "email_exists"].includes(code) || lower.includes("already been registered") || lower.includes("user already exists") || lower.includes("email already exists")) {
    return new InvitationError("AUTH_USER_EXISTS", "Un compte existe déjà avec cet email. Utilisez une autre adresse ou contactez l'assistance pour le rattacher.", 409);
  }
  if (code === "smtp_transport_error" || lower.includes("smtp") || lower.includes("mail provider") || lower.includes("sending invitation email")) {
    return new InvitationError("EMAIL_SMTP_FAILED", "L'email d'invitation n'a pas pu être envoyé. Réessayez ou contactez l'assistance.", 502);
  }
  return new InvitationError("SUPABASE_UNKNOWN", "L'invitation n'a pas pu être envoyée. Réessayez ou contactez l'assistance.", 500);
}

function mapReservationError(message: string): InvitationError {
  if (message.includes("INVITATION_USER_LIMIT")) return new InvitationError("USER_LIMIT", "La limite d'utilisateurs de votre abonnement est atteinte, invitations en attente comprises.", 403);
  if (message.includes("INVITATION_MEMBER_EXISTS")) return new InvitationError("MEMBER_EXISTS", "Cette personne est déjà membre de votre entreprise.", 409);
  if (message.includes("INVITATION_PENDING")) return new InvitationError("INVITE_PENDING", "Une invitation est déjà en attente pour cet email. Utilisez « Renvoyer le mail ».", 409);
  if (message.includes("INVITATION_INVALID_ROLE")) return new InvitationError("INVALID_ROLE", "Ce rôle n'appartient pas à votre entreprise.", 400);
  if (message.includes("INVITATION_FORBIDDEN")) return new InvitationError("FORBIDDEN", "Seul un administrateur peut inviter un utilisateur.", 403);
  return new InvitationError("SUPABASE_UNKNOWN", "L'invitation n'a pas pu être enregistrée. Contactez l'assistance.", 500);
}

/** Reserves a tenant-scoped invitation before dispatching an actual email. */
export async function inviteOrganizationUser(input: {
  email: string;
  roleId: string | null;
  fullName: string | null;
}): Promise<{ invitationId: string; email: string; authUserId: string }> {
  const workspace = await getActiveWorkspace();
  if (!workspace) throw new InvitationError("UNAUTHENTICATED", "Non authentifié.", 401);
  if (!isAdminRole(workspace.role)) throw new InvitationError("FORBIDDEN", "Seul un administrateur peut inviter un utilisateur.", 403);
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new InvitationError("INVALID_EMAIL", "Format d'email invalide.", 400);

  const organizationId = workspace.organization.id;
  const supabase = await createClient();
  const serviceClient = createServiceClient();
  let roleId = input.roleId;
  if (!roleId) {
    // Legacy companies may have only an administrator. Never use it as default.
    const { error } = await serviceClient.from("roles").upsert({
      organization_id: organizationId, name: "viewer", description: "Lecture seule",
    }, { onConflict: "organization_id,name", ignoreDuplicates: true });
    if (error) throw new InvitationError("INVALID_ROLE", "Le rôle de lecture seule n'a pas pu être préparé.", 500);
    const { data: viewer } = await serviceClient.from("roles").select("id")
      .eq("organization_id", organizationId).eq("name", "viewer").single();
    roleId = viewer?.id ?? null;
  }
  if (!roleId) throw new InvitationError("INVALID_ROLE", "Choisissez un rôle pour cet utilisateur.", 400);
  const { data: role } = await supabase.from("roles").select("id")
    .eq("id", roleId).eq("organization_id", organizationId).maybeSingle();
  if (!role) throw new InvitationError("INVALID_ROLE", "Ce rôle n'appartient pas à votre entreprise.", 400);

  const invitationId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex");
  const { error: reservationError } = await supabase.rpc("reserve_organization_invitation", {
    p_id: invitationId, p_organization_id: organizationId, p_email: email,
    p_role_id: roleId, p_full_name: input.fullName?.trim() || null, p_token: token,
  });
  if (reservationError) {
    console.error("[INVITE] reservation failed", { organizationId, code: reservationError.code, message: reservationError.message });
    throw mapReservationError(reservationError.message);
  }

  const redirectTo = `${getAppUrl()}/invitation?invitation=${invitationId}`;
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { organization_id: organizationId, role_id: roleId, invited_by: workspace.userId,
      full_name: input.fullName?.trim() || null, invitation_id: invitationId },
  });
  if (error || !data.user) {
    // Never delete a global auth account: the provider may have reused one.
    const { error: revokeError } = await serviceClient.from("invitations").update({ status: "revoked" })
      .eq("id", invitationId).eq("status", "pending");
    console.error("[INVITE] send failed", { organizationId, invitationId,
      code: error?.code, message: error?.message, revokeError: revokeError?.message });
    throw mapInviteError(error ?? { message: "Invitation email unavailable" });
  }

  const { data: linked, error: linkError } = await serviceClient.from("invitations")
    .update({ auth_user_id: data.user.id, invited_at: new Date().toISOString() })
    .eq("id", invitationId).eq("status", "pending").select("id").maybeSingle();
  if (linkError) {
    console.error("[INVITE] auth linkage failed after email dispatch", { invitationId, code: linkError.code, message: linkError.message });
    throw new InvitationError("SUPABASE_UNKNOWN", "L'email a été envoyé, mais sa confirmation est momentanément indisponible. Contactez l'assistance.", 500);
  }
  if (!linked) {
    const { data: current } = await serviceClient.from("invitations").select("status")
      .eq("id", invitationId).maybeSingle();
    if (current?.status !== "accepted") throw new InvitationError("INVITE_PENDING", "Cette invitation a été révoquée pendant son envoi.", 409);
  }
  console.info("[INVITE] sent", { invitationId, organizationId, invitedUserId: data.user.id });
  return { invitationId, email, authUserId: data.user.id };
}
