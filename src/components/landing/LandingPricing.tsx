"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions/plans";
import { Button } from "@/components/ui/button";

const planAccent: Record<string, { border: string; badge: string }> = {
  essentiel: {
    border: "border-slate-200",
    badge: "border-slate-200 bg-white text-slate-600",
  },
  business: {
    border: "border-blue-200 ring-1 ring-[#1E66D0]/20",
    badge: "bg-gradient-to-r from-[#38A3FF] to-[#1E66D0] text-white",
  },
  premium: {
    border: "border-slate-200",
    badge: "border-slate-200 bg-white text-slate-600",
  },
};

const formatPrice = (value: number) => value.toLocaleString("fr-FR");

export function LandingPricing() {
  const [yearly, setYearly] = useState(true);
  const plans = [...SUBSCRIPTION_PLANS].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section id="pricing" className="scroll-mt-24 bg-[#F8FBFF] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Tarifs
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            Des tarifs simples, en dirhams
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Tous les plans incluent les modules essentiels. Passez à l&apos;étape supérieure
            quand votre entreprise grandit.
          </p>
          <div className="mt-8 inline-flex items-center rounded-full border border-slate-200 bg-white p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                !yearly ? "bg-[#1E66D0] text-white shadow-md" : "text-slate-600"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                yearly ? "bg-[#1E66D0] text-white shadow-md" : "text-slate-600"
              }`}
            >
              Annuel
              <span className="ml-2 text-xs font-bold text-emerald-500">-2 mois</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const accent = planAccent[plan.code] ?? planAccent.essentiel;
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.code}
                className={`relative flex flex-col rounded-3xl border bg-white p-8 transition-all duration-200 ease-out focus:outline-2 focus:outline-[#2F7CF6]/35 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/10 ${accent.border} ${
                  plan.isRecommended ? "shadow-2xl shadow-blue-900/10 lg:-translate-y-3" : "shadow-sm"
                }`}
              >
                {plan.isRecommended && (
                  <span
                    className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold shadow-md ${accent.badge}`}
                  >
                    Recommandé
                  </span>
                )}
                <h3 className="text-xl font-bold text-[#0B2A5B]">{plan.name}</h3>
                <p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-[#061B3F]">
                    {formatPrice(price)}
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    MAD / {yearly ? "an" : "mois"}
                  </span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.featureHighlights.slice(0, 8).map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Check className="h-3 w-3 text-emerald-600" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.isRecommended ? "landingPrimary" : "landingSecondary"}
                  className="mt-8 h-12 w-full px-7"
                >
                  <Link href="/login?mode=register">
                    {plan.isRecommended ? (
                      <span className="relative z-10 !text-white">Commencer</span>
                    ) : (
                      <span className="relative z-10 !text-[#0F2548]">Commencer</span>
                    )}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Essai Essentiel gratuit, sans carte bancaire. Réservez votre module Business ou Premium à tout moment.
        </p>
      </div>
    </section>
  );
}
