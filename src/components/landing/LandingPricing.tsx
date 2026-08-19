"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions/plans";
import { filterPubliclyAvailablePlans } from "@/lib/subscriptions/commercial-offers";
import { Button } from "@/components/ui/button";

const formatPrice = (value: number) => value.toLocaleString("fr-FR");

const includedFeatures = [
  "Tableau de bord",
  "Clients / Tiers",
  "Ventes",
  "Facturation",
  "Achats",
  "Stock",
  "Trésorerie",
  "Comptabilité",
  "Articles",
  "Documents",
  "Paramètres",
  "Utilisateurs",
];

export function LandingPricing() {
  const [yearly, setYearly] = useState(true);
  const plans = [...filterPubliclyAvailablePlans(SUBSCRIPTION_PLANS)].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section id="pricing" className="scroll-mt-24 bg-[#F8FBFF] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1E66D0]">
            Tarifs
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
            Une offre simple pour gérer votre PME
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Tout ce qu&apos;il vous faut pour démarrer avec FelexiaERP, dans une
            formule unique et claire.
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

        <div className="mt-12 mx-auto max-w-3xl">
          {plans.map((plan) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.code}
                className="relative flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-blue-900/10 transition-all duration-200 ease-out focus:outline-2 focus:outline-[#2F7CF6]/35 sm:p-10"
              >
                <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-[#0B2A5B]">Essentiel</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                      {plan.description}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold tracking-tight text-[#061B3F]">
                      {formatPrice(price)}
                    </span>
                    <span className="text-sm font-medium text-slate-500">
                      MAD / {yearly ? "an" : "mois"}
                    </span>
                  </div>
                </div>
                <ul className="mt-8 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                  {includedFeatures.map((feature) => (
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
                  variant="landingPrimary"
                  className="mt-8 h-12 w-full px-7 sm:mt-10"
                >
                  <Link href="/login?mode=register">
                    <span className="relative z-10 !text-white">Démarrer gratuitement</span>
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Essai Essentiel gratuit, sans carte bancaire.
        </p>
      </div>
    </section>
  );
}
