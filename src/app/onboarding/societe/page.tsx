import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
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
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-lg shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-block rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
              <BrandLogo variant="horizontal" size="md" />
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
