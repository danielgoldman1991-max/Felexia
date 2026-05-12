"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activatePlanAction } from "@/lib/actions/activate-plan";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  stripe_price_monthly_id: string | null;
  stripe_price_yearly_id: string | null;
  features: string[];
  max_members: number;
  max_clients: number;
  max_invoices: number;
  includes_accounting: boolean;
  includes_treasury: boolean;
  includes_purchases: boolean;
  includes_stock: boolean;
  sort_order: number;
  is_public: boolean;
};

export function PlanSelection({
  plans,
  organizationId,
  stripeConfigured,
}: {
  plans: Plan[];
  organizationId: string;
  stripeConfigured: boolean;
}) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(plan: Plan) {
    setLoading(plan.id);
    setError(null);

    const canUseStripe = stripeConfigured &&
      ((billingInterval === "yearly" && plan.stripe_price_yearly_id) ||
       (billingInterval === "monthly" && plan.stripe_price_monthly_id));

    if (canUseStripe) {
      const priceId = billingInterval === "yearly"
        ? plan.stripe_price_yearly_id!
        : plan.stripe_price_monthly_id!;

      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            priceId,
            planSlug: plan.slug,
            billingInterval,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.url) {
          window.location.assign(data.url);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(null);
      }
      return;
    }

    const formData = new FormData();
    formData.set("planSlug", plan.slug);
    formData.set("organizationId", organizationId);
    const result = await activatePlanAction({ error: null }, formData);
    if (result.error) {
      setError(result.error);
      setLoading(null);
    }
  }

  const yearlyDiscount = plans.map((p) => {
    if (p.price_monthly === 0) return 0;
    const monthlyYearly = p.price_monthly * 12;
    return Math.round((1 - p.price_yearly / monthlyYearly) * 100);
  })[0] || 0;

  function formatPrice(price: number): string {
    if (price === 0) return "Gratuit";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 0,
    }).format(price);
  }

  function formatPeriod(price: number): string {
    if (price === 0) return "";
    return billingInterval === "monthly" ? "/mois" : "/an";
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-1">
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              billingInterval === "monthly"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[var(--secondary)] hover:text-[var(--foreground)]",
            )}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("yearly")}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              billingInterval === "yearly"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[var(--secondary)] hover:text-[var(--foreground)]",
            )}
          >
            Annuel
            {yearlyDiscount > 0 && (
              <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                -{yearlyDiscount}%
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const price = billingInterval === "yearly" ? plan.price_yearly : plan.price_monthly;
          const isFree = price === 0;
          const isPopular = plan.slug === "essentiel";

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-[var(--card)] p-6 shadow-[var(--shadow-sm)] transition hover:shadow-md",
                isPopular && "border-blue-200 ring-2 ring-blue-600/10",
              )}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Le plus populaire
                </span>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-3xl font-bold">{formatPrice(price)}</span>
                <span className="text-sm text-[var(--muted)]">{formatPeriod(price)}</span>
                {!isFree && billingInterval === "yearly" && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Soit {formatPrice(plan.price_monthly)}/mois
                  </p>
                )}
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {typeof plan.features === "string" ? (
                  (JSON.parse(plan.features) as string[]).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span>{feature}</span>
                    </li>
                  ))
                ) : (
                  (plan.features as unknown as string[])?.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span>{feature}</span>
                    </li>
                  ))
                )}
                {plan.max_members > 0 && (
                  <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                    <span>Jusqu&apos;a {plan.max_members} utilisateur{plan.max_members > 1 ? "s" : ""}</span>
                  </li>
                )}
              </ul>
              <Button
                onClick={() => handleSelect(plan)}
                disabled={loading !== null}
                variant={isPopular ? "primary" : "secondary"}
                className={cn("w-full")}
              >
                {loading === plan.id ? "Chargement..." : isFree ? "Commencer gratuitement" : "Choisir cette formule"}
              </Button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
