"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Check, CreditCard, Database, FileText, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getPlanDefinition, SUBSCRIPTION_PLANS, type PlanCode } from "@/lib/subscriptions/plans";

type CurrentSubscription = Record<string, unknown> & {
  plan_code?: string | null;
  status?: string | null;
  billing_cycle?: string | null;
  billing_interval?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean | null;
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
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const currentPlan = getPlanDefinition(currentSubscription?.plan_code);
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
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const payload = await response.json();
      if (payload.url) window.location.href = payload.url;
    } finally {
      setLoadingPortal(false);
    }
  }

  async function choosePlan(planCode: PlanCode) {
    if (!hasStripe) return;
    setLoadingPlan(planCode);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingInterval: "monthly" }),
      });
      const payload = await response.json();
      if (payload.url) {
        window.location.href = payload.url;
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  function formatLimit(value: number | null): string {
    return value === null ? "Illimite" : new Intl.NumberFormat("fr-FR").format(value);
  }

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
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Metric label="Pack" value={currentPlan.name} icon={<ShieldCheck className="h-4 w-4" />} />
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
            <p className="md:col-span-4 text-sm text-[var(--muted)]">
              Fin de période : <span className="font-medium text-[var(--foreground)]">{new Date(periodEnd).toLocaleDateString("fr-FR")}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        {currentSubscription?.stripe_customer_id ? (
          <Button variant="secondary" disabled={!hasStripe || loadingPortal} onClick={openBillingPortal}>
            {loadingPortal ? "Redirection..." : "Gerer la facturation"}
          </Button>
        ) : null}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Changer de pack</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = plan.code === currentPlan.code;
            return (
              <Card
                key={plan.code}
                className={cn(
                  "relative flex flex-col",
                  plan.isRecommended && "border-blue-400 shadow-[0_18px_50px_rgba(37,99,235,0.14)]",
                  isCurrent && "ring-2 ring-blue-600/20",
                )}
              >
                {plan.isRecommended && (
                  <div className="absolute right-4 top-4">
                    <Badge tone="info">Recommandé</Badge>
                  </div>
                )}
                <CardHeader>
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="min-h-10 text-sm text-[var(--muted)]">{plan.description}</p>
                  <p className="pt-2 text-3xl font-bold">{plan.monthlyPrice} MAD<span className="text-sm font-medium text-[var(--muted)]"> / mois</span></p>
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
                      variant={isCurrent ? "secondary" : "primary"}
                      disabled={isCurrent || !hasStripe || loadingPlan !== null}
                      onClick={() => choosePlan(plan.code)}
                    >
                      {isCurrent ? "Plan actuel" : loadingPlan === plan.code ? "Redirection..." : "Choisir ce plan"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
