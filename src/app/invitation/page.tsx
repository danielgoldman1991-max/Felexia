import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { VerifyInviteLink } from "@/components/auth/verify-invite-link";
import type { InvitationPreview } from "@/lib/auth/invitation-callback";

export default async function InvitationPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : undefined;
  const code = typeof params.code === "string" ? params.code : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;
  const invitationId = typeof params.invitation === "string" ? params.invitation : undefined;
  let legacyMessage: string | null = null;

  if (token) {
    const supabase = await createClient();
    const { data: invitation } = await supabase.rpc("get_invitation_by_token", { p_token: token }).maybeSingle<InvitationPreview>();
    if (!invitation || invitation.status !== "pending" || new Date(invitation.expires_at) <= new Date()) {
      legacyMessage = "Cette invitation est invalide, expirée ou déjà utilisée. Demandez à votre administrateur de renvoyer l'email d'invitation.";
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email_confirmed_at && user.email?.toLowerCase() === invitation.email.toLowerCase()) {
        redirect(`/invitation/complete?invitation=${encodeURIComponent(invitation.id)}`);
      }
      legacyMessage = "Ce lien manuel doit être remplacé par une invitation email. Demandez à votre administrateur d'utiliser « Renvoyer le mail » dans la liste des utilisateurs.";
    }
  }

  // Never redirect from cookies here: a valid email can carry another account's
  // session in its fragment, invisible to the server until the client reads it.
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-block rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
              <BrandLogo variant="horizontal" size="md" />
            </span>
          </div>
          <h1 className="text-2xl font-semibold">Votre invitation Felexia Pro</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Rejoignez votre entreprise en quelques instants.</p>
        </CardHeader>
        <CardContent>
          {legacyMessage ? <p className="text-sm leading-6 text-[var(--muted)]">{legacyMessage}</p> : (
            <VerifyInviteLink tokenHash={tokenHash} code={code} type={type} invitationId={invitationId} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
