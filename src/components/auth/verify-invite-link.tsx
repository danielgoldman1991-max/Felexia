"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cleanInvitationCallbackUrl, invitationFragmentSession } from "@/lib/auth/invitation-callback";

type VerifyState = { error: string | null };

function friendlyVerifyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("token has expired") || lower.includes("invalid token") || lower.includes("token") && lower.includes("invalid")) {
    return "Ce lien est invalide ou a expiré. Demandez à votre administrateur de renvoyer l'invitation.";
  }
  if (lower.includes("email not confirmed") || lower.includes("otp")) {
    return "L'invitation n'a pas pu être validée. Demandez à votre administrateur de renvoyer l'invitation.";
  }
  return "Le lien n'a pas pu être validé. Réessayez ou demandez à votre administrateur de renvoyer l'invitation.";
}

/**
 * Étape 1 du flux d'invitation Supabase (inviteUserByEmail).
 * Le lien reçu par email arrive sur /invitation?invitation=…&token_hash=…&type=invite
 * (ou ?code=… en mode PKCE). Ce composant échange le token et établit la
 * session, puis redirige vers /invitation/complete pour définir le mot de
 * passe et créer le membership.
 */
export function VerifyInviteLink({
  tokenHash,
  code,
  type,
  invitationId,
}: {
  tokenHash?: string;
  code?: string;
  type?: string;
  invitationId?: string;
}) {
  const router = useRouter();

  async function verify(): Promise<VerifyState> {
    const supabase = createClient();

    let error: { message: string } | null = null;
    const fragmentValues = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const fragmentSession = invitationFragmentSession(window.location.hash);
    if (fragmentValues.has("error")) {
      window.history.replaceState(window.history.state, "", cleanInvitationCallbackUrl(window.location.href));
      return { error: "Ce lien a expiré ou a déjà été utilisé. Demandez à votre administrateur de renvoyer l'invitation." };
    }
    if (!fragmentSession && (fragmentValues.has("access_token") || fragmentValues.has("refresh_token"))) {
      window.history.replaceState(window.history.state, "", cleanInvitationCallbackUrl(window.location.href));
      return { error: "Le lien d'invitation est incomplet. Demandez à votre administrateur de le renvoyer." };
    }
    if (fragmentSession) {
      window.history.replaceState(window.history.state, "", cleanInvitationCallbackUrl(window.location.href));
      const result = await supabase.auth.setSession(fragmentSession);
      error = result.error;
    } else if (tokenHash) {
      const result = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === "email" ? "email" : "invite",
      });
      error = result.error;
    } else if (code) {
      // createBrowserClient may have already consumed the PKCE code while
      // initializing. It removes ?code only after a successful exchange.
      const initialized = await supabase.auth.getUser();
      if (!initialized.data.user || new URL(window.location.href).searchParams.has("code")) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      }
    } else {
      // An already established invitation session can resume completion.
      const session = await supabase.auth.getUser();
      if (session.error || !session.data.user) {
        return { error: "Ce lien d'invitation est invalide ou a expiré." };
      }
    }

    if (error) {
      console.error("[INVITE] verify failed", {
        tokenHashPresent: Boolean(tokenHash),
        codePresent: Boolean(code),
        errorMessage: error.message,
      });
      return { error: friendlyVerifyError(error.message) };
    }

    window.history.replaceState(window.history.state, "", cleanInvitationCallbackUrl(window.location.href));
    router.replace(
      invitationId ? `/invitation/complete?invitation=${encodeURIComponent(invitationId)}` : "/invitation/complete",
    );
    router.refresh();
    return { error: null };
  }

  const [state, formAction, pending] = useActionState(verify, { error: null });

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-[var(--muted)]">
        Validez le lien de votre invitation pour rejoindre votre organisation.
      </p>
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <form action={formAction}>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Validation..." : "Valider mon invitation"}
        </Button>
      </form>
    </div>
  );
}
