import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRoleKey } from "@/lib/env";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

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

  const { data: invitation } = await supabase
    .from("invitations")
    .select("*, organization:organizations(name)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

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

  const orgName = typeof invitation.organization === "object" && invitation.organization
    ? (invitation.organization as { name: string }).name
    : "l'organisation";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
              <Logo size={36} />
            </span>
            <p className="text-sm font-semibold text-[var(--secondary)]">Felexia</p>
          </div>
          <h1 className="text-2xl font-semibold">Rejoindre {orgName}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Vous avez ete invite a rejoindre {orgName} sur Felexia.
          </p>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={token} email={invitation.email} />
        </CardContent>
      </Card>
    </main>
  );
}
