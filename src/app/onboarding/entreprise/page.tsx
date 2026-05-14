import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EntrepriseForm } from "@/components/auth/entreprise-form";
import { getUserOnboardingStatus } from "@/lib/saas";

export default async function EntreprisePage() {
  const status = await getUserOnboardingStatus();

  // Not authenticated → redirect to login
  if (status.nextPath === "/login") {
    redirect("/login");
  }

  // Already has an organization → go to correct next step
  if (status.hasOrganization) {
    redirect(status.nextPath);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <Card className="w-full max-w-lg shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
              <Logo size={36} />
            </span>
            <p className="text-sm font-semibold text-[var(--secondary)]">Configurez votre entreprise</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Créer mon entreprise</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Ces informations sont modifiables plus tard dans les paramètres.</p>
        </CardHeader>
        <CardContent>
          <EntrepriseForm />
        </CardContent>
      </Card>
    </main>
  );
}
