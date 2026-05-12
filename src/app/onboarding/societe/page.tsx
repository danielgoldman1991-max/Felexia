import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CompanySetupForm } from "@/components/auth/company-setup-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CompanySetupPage() {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.sub)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/onboarding/formule");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-lg shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
              <Logo size={36} />
            </span>
            <p className="text-sm font-semibold text-[var(--secondary)]">Configurez votre entreprise</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Votre societe</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Ces informations sont modifiables plus tard dans les parametres.</p>
        </CardHeader>
        <CardContent>
          <CompanySetupForm />
        </CardContent>
      </Card>
    </main>
  );
}
