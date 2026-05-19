"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, X } from "lucide-react";

export function TrialStartedBanner({ forceOpen = false }: { forceOpen?: boolean }) {
  const [isHidden, setIsHidden] = useState(false);

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
        aria-label="Masquer le message d'essai gratuit"
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
              Pack Business activé
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              Votre période d’essai Business a démarré.
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Bienvenue sur Felexia. Votre entreprise est prête et vous bénéficiez de 14 jours d’essai gratuit du pack Business, sans carte bancaire et sans engagement.
            </p>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Vous pouvez commencer à gérer vos clients, devis, factures, documents et paiements. Vous pourrez choisir votre abonnement plus tard depuis Paramètres &gt; Abonnement.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:pt-9">
          <Link
            href="/clients"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Commencer maintenant
          </Link>
          <Link
            href="/parametres/abonnement"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voir mon abonnement
          </Link>
        </div>
      </div>
    </section>
  );
}
