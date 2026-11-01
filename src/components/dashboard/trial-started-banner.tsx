"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { PLAN_LABELS } from "@/lib/subscriptions/plans-config";
import { isPlanQuoteOnly } from "@/lib/subscriptions/commercial-offers";

export function TrialStartedBanner({
  forceOpen = false,
  planCode = "essentiel",
}: {
  forceOpen?: boolean;
  planCode?: string;
}) {
  const [isHidden, setIsHidden] = useState(false);
  const planLabel = PLAN_LABELS[planCode as keyof typeof PLAN_LABELS] ?? PLAN_LABELS.essentiel;
  const proAccess = isPlanQuoteOnly(planCode);

  function hideBanner() {
    setIsHidden(true);
  }

  if (isHidden && !forceOpen) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={hideBanner}
        className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label={proAccess ? "Masquer le message d’accès PRO" : "Masquer le message d'essai"}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-4 pr-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Pack {planLabel} activé
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              {proAccess ? "Votre accès PRO est activé." : <>Votre essai {planLabel} a démarré.</>}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {proAccess ? "Votre entreprise dispose de l’ERP complet pour découvrir ses modules. Retrouvez les conditions et la durée de votre accès dans Paramètres > Abonnement." : <>Bienvenue sur Felexia. Votre entreprise est prête et vous bénéficiez d&apos;un essai {planLabel}, sans carte bancaire et sans engagement.</>}
            </p>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {proAccess ? "Explorez les ventes, les achats, le stock, la comptabilité, la TVA et les ressources humaines. PRO est proposé uniquement sur devis." : "Créez vos factures de vente et d’achat, enregistrez leurs règlements et suivez votre trésorerie. Vos journaux restent accessibles. Vous pourrez gérer votre abonnement depuis Paramètres > Abonnement."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:pt-9">
          <Link
            href="/facturation/factures/new"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
          >
            Créer une facture
          </Link>
          <Link
            href="/parametres/abonnement"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {proAccess ? "Voir mon accès PRO" : "Voir mon abonnement"}
          </Link>
        </div>
      </div>
    </section>
  );
}
