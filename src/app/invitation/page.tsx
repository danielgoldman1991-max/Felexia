import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

type InvitationByToken = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  email: string;
  role_id: string | null;
  status: string;
  expires_at: string;
};

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: invitation } = (await supabase
    .rpc("get_invitation_by_token", { p_token: token })
    .maybeSingle()) as {
    data: InvitationByToken | null;
    error: { message: string } | null;
  };

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <Card className="w-full max-w-md text-center shadow-[var(--shadow-md)]">
          <CardHeader>
            <h1 className="text-2xl font-semibold">Invitation invalide</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cette invitation est invalide ou a expiree. Contactez votre administrateur.
            </p>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const orgName = typeof invitation.organization_name === "string" && invitation.organization_name
    ? invitation.organization_name
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
            Vous avez ete invite a rejoindre {orgName} sur FelexiaERP.
          </p>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={token} email={invitation.email} />
        </CardContent>
      </Card>
    </main>
  );
}
