"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

export type CompleteInvitationState = { error: string | null };

/**
 * Termine une invitation Supabase (inviteUserByEmail) :
 * 1. valide l'invitation (pending, non expirée, email = session) ;
 * 2. définit le mot de passe de l'utilisateur (session invite déjà établie
 *    par verifyOtp) ;
 * 3. crée le membership dans l'organisation de l'invitation et marque
 *    l'invitation "accepted" — atomiquement via le RPC security definer
 *    app_private.accept_invitation_for_user.
 *
 * L'organization_id et le rôle proviennent UNIQUEMENT de la ligne
 * d'invitation en base (jamais des arguments du client).
 */
export async function completeInvitationAction(
  _prev: CompleteInvitationState,
  formData: FormData,
): Promise<CompleteInvitationState> {
  const invitationId = String(formData.get("invitationId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!invitationId) {
    return { error: "Invitation introuvable. Recliquez le lien reçu par email." };
  }
  if (password.length < 6) {
    return { error: "Le mot de passe doit faire au moins 6 caractères." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Session expirée. Recliquez le lien reçu par email pour continuer." };
  }

  // 1. Validation de l'invitation (lecture côté serveur via service role)
  const serviceClient = createServiceClient();
  const { data: invitation, error: readError } = await serviceClient
    .from("invitations")
    .select("id, organization_id, email, token, status, expires_at, full_name, auth_user_id")
    .eq("id", invitationId)
    .maybeSingle();

  if (readError || !invitation) {
    console.error("[INVITE] complete: invitation not found", {
      invitationId,
      userId: user.id,
      dbCode: readError?.code ?? null,
      dbMessage: readError?.message ?? null,
    });
    return { error: "Invitation introuvable. Recliquez le lien reçu par email." };
  }

  if ((invitation.email?.toLowerCase() ?? "") !== (user.email?.toLowerCase() ?? "")) {
    console.error("[INVITE] complete: email mismatch", {
      invitationId,
      invitationEmail: invitation.email,
      userId: user.id,
    });
    return {
      error:
        "Ce lien d'invitation ne correspond pas à votre compte. Déconnectez-vous et ouvrez le lien avec l'adresse email invitée.",
    };
  }
  if (invitation.auth_user_id && invitation.auth_user_id !== user.id) {
    return { error: "Cette invitation ne correspond pas à votre compte." };
  }
  if (!user.email_confirmed_at) return { error: "Validez d'abord le lien reçu par email." };
  if (invitation.status === "accepted") {
    const { data: member } = await supabase.from("organization_members").select("id")
      .eq("organization_id", invitation.organization_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    return { error: member ? null : "Cette invitation a déjà été utilisée." };
  }
  if (invitation.status !== "pending" || new Date(invitation.expires_at).getTime() <= Date.now()) {
    return { error: "Cette invitation a expiré ou a été révoquée. Contactez votre administrateur." };
  }

  // 2. Définition du mot de passe
  const { error: passwordError } = await supabase.auth.updateUser({
    password,
    data: fullName ? { full_name: fullName } : undefined,
  });
  if (passwordError) {
    console.error("[INVITE] complete: updateUser password failed", {
      invitationId,
      organizationId: invitation.organization_id,
      userId: user.id,
      supabaseCode: passwordError.code ?? null,
      supabaseMessage: passwordError.message,
    });
    return { error: passwordError.message };
  }

  // 3. Membership atomique + acceptation
  const { data: accepted, error: acceptError } = await supabase.rpc(
    "accept_invitation_for_user",
    { p_token: invitation.token, p_user_id: user.id },
  );
  if (acceptError) {
    console.error("[INVITE] complete: accept rpc failed", {
      invitationId,
      organizationId: invitation.organization_id,
      userId: user.id,
      dbCode: acceptError.code ?? null,
      dbMessage: acceptError.message,
    });
    return { error: "L'invitation n'a pas pu être finalisée. Réessayez ou contactez votre administrateur." };
  }
  if (!accepted) {
    return { error: "L'invitation n'a pas pu être finalisée. Contactez votre administrateur." };
  }

  const chosenName = fullName || invitation.full_name;
  if (chosenName) {
    const { error: profileError } = await supabase.from("profiles")
      .update({ full_name: chosenName }).eq("id", user.id);
    if (profileError) console.error("[INVITE] profile name update failed", { userId: user.id, code: profileError.code });
  }

  console.info("[INVITE] completed", {
    invitationId,
    organizationId: invitation.organization_id,
    userId: user.id,
    emailDomain: user.email?.split("@")[1] ?? null,
  });

  return { error: null };
}
