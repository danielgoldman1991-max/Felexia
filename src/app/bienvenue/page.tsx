import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { WelcomeChecklist } from "@/components/onboarding/welcome-checklist";
import { Button } from "@/components/ui/button";
import { requireActiveWorkspace } from "@/lib/auth";
import { getOnboardingChecklist } from "@/lib/onboarding";
import { PLAN_LABELS } from "@/lib/subscriptions/plans-config";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams?: Promise<{ trial?: string | string[] }>;
}) {
  const workspace = await requireActiveWorkspace();
  const checklist = await getOnboardingChecklist(workspace.organization.id);
  const params = await searchParams;
  const trialParam = Array.isArray(params?.trial) ? params.trial[0] : params?.trial;
  const showTrialBanner = Boolean(trialParam && (trialParam === "business" || trialParam === "essentiel"));
  const planLabel = PLAN_LABELS[workspace.subscription?.planCode ?? "essentiel"] ?? "Essentiel";

  const trialEndsAt = workspace.subscription?.trialEndsAt;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="inline-block rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
            <BrandLogo variant="horizontal" size="md" />
          </span>
          <p className="text-xs text-slate-500">Configuration guidée</p>
        </div>

        {showTrialBanner && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-950">Votre entreprise est prête</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Votre essai {planLabel} est activé. Les modules {planLabel} sont disponibles pour démarrer Felexia sans blocage.
                </p>
                {trialEndsAt && (
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Essai valable jusqu&apos;au {new Date(trialEndsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/dashboard?skipWelcome=1">
                    <Button>
                      Accéder au tableau de bord
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/parametres/abonnement">
                    <Button variant="secondary">Voir mon abonnement</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <WelcomeChecklist checklist={checklist} />
      </div>
    </main>
  );
}
