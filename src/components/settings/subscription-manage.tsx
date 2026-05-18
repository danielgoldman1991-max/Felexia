"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, CreditCard, Database, FileText, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getPlanDefinition, SUBSCRIPTION_PLANS, type PlanCode } from "@/lib/subscriptions/plans";

type BillingInterval = "monthly" | "yearly";

type CurrentSubscription = Record<string, unknown> & {
  plan_code?: string | null;
  status?: string | null;
  billing_cycle?: string | null;
  billing_interval?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean | null;
  stripe_customer_id?: string | null;
};

export function SubscriptionManage({
  currentSubscription,
  memberCount,
  documentsThisMonth,
  storageUsedMb,
  hasStripe,
}: {
  currentSubscription: CurrentSubscription | null;
  plans?: Record<string, unknown>[];
  organizationId: string;
  memberCount: number;
  documentsThisMonth?: number;
  storageUsedMb?: number;
  hasStripe: boolean;
  enabledModules?: string[];
  catalog?: unknown[];
}) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = getPlanDefinition(currentSubscription?.plan_code);
  const currentPlanCode = currentPlan.code;
  const currentBillingCycle: BillingInterval = (
    currentSubscription?.billing_cycle ||
    currentSubscription?.billing_interval ||
    "monthly"
  ) as BillingInterval;

  const status = currentSubscription?.status ?? "trialing";
  const periodEnd = currentSubscription?.current_period_end ?? currentSubscription?.trial_ends_at ?? currentSubscription?.trial_end ?? null;

  const statusBadge: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
    active: { label: "Actif", tone: "success" },
    trialing: { label: "Essai gratuit", tone: "info" },
    past_due: { label: "Paiement en retard", tone: "danger" },
    canceled: { label: "Résilié", tone: "neutral" },
    unpaid: { label: "Impayé", tone: "danger" },
  };

  async function openBillingPortal() {
    if (!hasStripe) return;
    setLoadingPortal(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Erreur portail Stripe : ${response.status}`);
      }
      if (payload?.url) {
        window.location.href = payload.url;
      } else {
        throw new Error("Aucune URL portail Stripe reçue.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue portail Stripe.");
    } finally {
      setLoadingPortal(false);
    }
  }

  async function choosePlan(planCode: PlanCode) {
    if (!hasStripe) return;
    setLoadingPlan(planCode);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingInterval }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Erreur Stripe Checkout : ${response.status}`);
      }
      if (!payload?.url) {
        throw new Error("Aucune URL Stripe reçue depuis le serveur.");
      }
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue lors de la redirection Stripe.");
    } finally {
      setLoadingPlan(null);
    }
  }

  function formatLimit(value: number | null): string {
    return value === null ? "Illimite" : new Intl.NumberFormat("fr-FR").format(value);
  }

  function formatPrice(plan: typeof SUBSCRIPTION_PLANS[number]): string {
    return billingInterval === "yearly" ? `${plan.yearlyPrice} MAD` : `${plan.monthlyPrice} MAD`;
  }

  function formatPeriodLabel(): string {
    return billingInterval === "yearly" ? "/ an" : "/ mois";
  }

  const yearlySavings = useMemo(() => {
    return SUBSCRIPTION_PLANS.map((plan) => {
      const monthlyEquivalent = Math.round(plan.yearlyPrice / 12);
      return { code: plan.code, monthlyEquivalent };
    });
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Plan actuel</h2>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Les modules Felexia sont maintenant inclus selon votre pack.
              </p>
            </div>
            <Badge tone={statusBadge[status]?.tone ?? "neutral"}>{statusBadge[status]?.label ?? status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Metric label="Pack" value={currentPlan.name} icon={<ShieldCheck className="h-4 w-4" />} />
          <Metric label="Cycle" value={currentBillingCycle === "yearly" ? "Annuel" : "Mensuel"} icon={<CreditCard className="h-4 w-4" />} />
          <Metric label="Utilisateurs" value={`${memberCount}/${currentPlan.limits.users}`} icon={<Users className="h-4 w-4" />} />
          <Metric
            label="Documents / mois"
            value={`${documentsThisMonth ?? 0}/${formatLimit(currentPlan.limits.commercialDocumentsPerMonth)}`}
            icon={<FileText className="h-4 w-4" />}
          />
          <Metric
            label="Stockage"
            value={`${storageUsedMb ?? 0} Mo/${currentPlan.limits.storageMb} Mo`}
            icon={<Database className="h-4 w-4" />}
          />
          {periodEnd && (
            <p className="md:col-span-5 text-sm text-[var(--muted)]">
              Fin de période : <span className="font-medium text-[var(--foreground)]">{new Date(periodEnd).toLocaleDateString("fr-FR")}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Changer de pack</h2>
        <div className="flex items-center gap-2">
          {currentSubscription?.stripe_customer_id ? (
            <Button variant="secondary" disabled={!hasStripe || loadingPortal} onClick={openBillingPortal}>
              {loadingPortal ? "Redirection..." : "Gerer la facturation"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1">
        <button
          type="button"
          onClick={() => setBillingInterval("monthly")}
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-sm)] px-5 py-2 text-sm font-medium transition-all",
            billingInterval === "monthly"
              ? "bg-white text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          Mensuel
        </button>
        <button
          type="button"
          onClick={() => setBillingInterval("yearly")}
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-sm)] px-5 py-2 text-sm font-medium transition-all",
            billingInterval === "yearly"
              ? "bg-white text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          Annuel
          <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            Économisez ~2 mois
          </span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrentPlan = plan.code === currentPlanCode && billingInterval === currentBillingCycle;
          const savings = yearlySavings.find((s) => s.code === plan.code);

          return (
            <Card
              key={plan.code}
              className={cn(
                "relative flex flex-col",
                plan.isRecommended && "border-blue-400 shadow-[0_18px_50px_rgba(37,99,235,0.14)]",
                isCurrentPlan && "ring-2 ring-blue-600/20",
              )}
            >
              {plan.isRecommended && (
                <div className="absolute right-4 top-4">
                  <Badge tone="info">Recommandé</Badge>
                </div>
              )}
              {billingInterval === "yearly" && (
                <div className="absolute left-4 top-4">
                  <Badge tone="success">Meilleure valeur</Badge>
                </div>
              )}
              <CardHeader>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="min-h-10 text-sm text-[var(--muted)]">{plan.description}</p>
                <p className="pt-2 text-3xl font-bold">
                  {formatPrice(plan)}
                  <span className="text-sm font-medium text-[var(--muted)]">{formatPeriodLabel()}</span>
                </p>
                {billingInterval === "yearly" && savings && (
                  <p className="text-sm text-[var(--muted)]">
                    Soit environ <span className="font-medium text-[var(--foreground)]">{savings.monthlyEquivalent} MAD</span> / mois
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="mb-5 space-y-2">
                  {plan.featureHighlights.slice(0, 8).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto space-y-3">
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
                    {plan.limitHighlights.join(" · ")}
                  </div>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "secondary" : "primary"}
                    disabled={isCurrentPlan || !hasStripe || loadingPlan !== null}
                    onClick={() => choosePlan(plan.code)}
                  >
                    {isCurrentPlan
                      ? "Plan actuel"
                      : loadingPlan === plan.code
                        ? "Redirection..."
                        : billingInterval === "yearly"
                          ? "Choisir ce plan annuel"
                          : "Choisir ce plan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
