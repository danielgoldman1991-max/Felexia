import { redirect } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LABELS } from "@/lib/subscriptions/plans-config";

export default async function TrialConfirmationPage() {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.sub)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding/inscription");
  }

  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("status, trial_end, plan_code")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  const planLabel = PLAN_LABELS[sub?.plan_code as keyof typeof PLAN_LABELS] ?? "Essentiel";
  const trialEnd = sub?.trial_end
    ? new Date(sub.trial_end).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md text-center shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex justify-center">
            <span className="inline-block rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
              <BrandLogo variant="horizontal" size="md" />
            </span>
          </div>
          <h1 className="text-2xl font-semibold">Essai {planLabel} démarré !</h1>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Votre essai {planLabel} est actif jusqu&apos;au <strong className="text-[var(--foreground)]">{trialEnd || "1 mois"}</strong>.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Profitez de toutes les fonctionnalités sélectionnées. Aucune carte bancaire requise.
          </p>
          <Link
            href="/bienvenue"
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-blue-600 px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-500"
          >
            Finaliser ma configuration
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
