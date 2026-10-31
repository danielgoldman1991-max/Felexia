import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { CompleteInviteForm } from "@/components/auth/complete-invite-form";

/**
 * Étape 2 du flux d'invitation Supabase : après verifyOtp, l'invité définit
 * son mot de passe ici. Le membership est créé par la server action
 * (RPC atomique) avec l'organization_id de la ligne d'invitation — jamais
 * avec une valeur fournie par l'URL ou le client.
 */
export default async function CompleteInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const invitationId =
    typeof params.invitation === "string" ? params.invitation : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <Card className="w-full max-w-md text-center shadow-[var(--shadow-md)]">
          <CardHeader>
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="inline-block rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
                <BrandLogo variant="horizontal" size="md" />
              </span>
              <p className="text-sm font-semibold text-[var(--secondary)]">FelexiaERP</p>
            </div>
            <h1 className="text-2xl font-semibold">Session expirée</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cliquez à nouveau sur le lien reçu dans l&apos;email d&apos;invitation pour
              finaliser votre inscription.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="primary" className="w-full" asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const serviceClient = createServiceClient();

  const inviteQuery = invitationId
    ? serviceClient
        .from("invitations")
        .select("id, organization_id, email, status, expires_at, auth_user_id, full_name, organization:organizations(name)")
        .eq("id", invitationId)
        .maybeSingle()
    : serviceClient
        .from("invitations")
        .select("id, organization_id, email, status, expires_at, auth_user_id, full_name, organization:organizations(name)")
        .eq("status", "pending")
        .eq("auth_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const { data: invitation } = await inviteQuery;

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <Card className="w-full max-w-md text-center shadow-[var(--shadow-md)]">
          <CardHeader>
            <h1 className="text-2xl font-semibold">Invitation introuvable</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Aucune invitation en attente ne correspond à votre compte.
              Contactez votre administrateur.
            </p>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (
    (invitation.email?.toLowerCase() ?? "") !== (user.email?.toLowerCase() ?? "") ||
    Boolean(invitation.auth_user_id && invitation.auth_user_id !== user.id)
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <Card className="w-full max-w-md text-center shadow-[var(--shadow-md)]">
          <CardHeader>
            <h1 className="text-2xl font-semibold">Compte non concordant</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Vous êtes connecté avec {user.email}, mais cette invitation est destinée
              à un autre compte. Déconnectez-vous puis ouvrez le lien avec l&apos;adresse
              email invitée.
            </p>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (invitation.status === "accepted") {
    redirect("/dashboard");
  }

  if (
    invitation.status !== "pending" ||
    new Date(invitation.expires_at) < new Date()
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <Card className="w-full max-w-md text-center shadow-[var(--shadow-md)]">
          <CardHeader>
            <h1 className="text-2xl font-semibold">Invitation expirée</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cette invitation a expiré ou a été révoquée. Contactez votre administrateur.
            </p>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const orgName =
    typeof invitation.organization === "object" &&
    invitation.organization !== null &&
    "name" in invitation.organization &&
    typeof (invitation.organization as { name: string }).name === "string"
      ? (invitation.organization as { name: string }).name
      : "l'organisation";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-block rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
              <BrandLogo variant="horizontal" size="md" />
            </span>
            <p className="text-sm font-semibold text-[var(--secondary)]">FelexiaERP</p>
          </div>
          <h1 className="text-2xl font-semibold">Rejoindre {orgName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Choisissez votre mot de passe pour finaliser votre inscription et
            accéder à {orgName}.
          </p>
        </CardHeader>
        <CardContent>
          <CompleteInviteForm
            invitationId={invitation.id}
            email={invitation.email}
            orgName={orgName}
            fullName={invitation.full_name ?? ""}
          />
        </CardContent>
      </Card>
    </main>
  );
}
