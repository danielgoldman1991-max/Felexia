"use client";

import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_PLANS, type PlanCode } from "@/lib/subscriptions/plans";
import { filterPubliclyAvailablePlans } from "@/lib/subscriptions/commercial-offers";

export function PlanChoiceClient({ hasStripe }: { hasStripe: boolean }) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<PlanCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choosePlan(planCode: PlanCode) {
    if (!hasStripe || loadingPlan) return;
    setLoadingPlan(planCode);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingInterval: billingCycle }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Impossible d'ouvrir le paiement pour le moment.");
      }
      window.location.assign(payload.url);
    } catch (err) {
      setError((err as Error).message);
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["monthly", "yearly"] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBillingCycle(cycle)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                billingCycle === cycle ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted)] hover:bg-[var(--surface-soft)]",
              )}
            >
              {cycle === "monthly" ? "Mensuel" : "Annuel"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        {filterPubliclyAvailablePlans(SUBSCRIPTION_PLANS).map((plan) => {
          const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <article
              key={plan.code}
              className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5"
            >
              <h2 className="text-xl font-semibold text-slate-950">{plan.name}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
              <p className="mt-5 text-3xl font-bold text-slate-950">
                {price} MAD
                <span className="text-sm font-medium text-slate-500"> / {billingCycle === "monthly" ? "mois" : "an"}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2">
                {plan.featureHighlights.slice(0, 8).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant="primary"
                disabled={!hasStripe || loadingPlan !== null}
                onClick={() => choosePlan(plan.code)}
              >
                {loadingPlan === plan.code ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Redirection...
                  </>
                ) : (
                  `Souscrire à ${plan.name}`
                )}
              </Button>
            </article>
          );
        })}
      </div>

      {!hasStripe && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          Le paiement Stripe n&apos;est pas encore configuré. Vous pouvez démarrer l&apos;essai Essentiel ou configurer Stripe.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
