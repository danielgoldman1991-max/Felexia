"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModuleInfo } from "@/lib/saas";

export function SubscriptionManage({
  currentSubscription,
  plans,
  memberCount,
  hasStripe,
  enabledModules,
  catalog,
  ..._rest
}: {
  currentSubscription: Record<string, unknown> | null;
  plans: Record<string, unknown>[];
  organizationId: string;
  memberCount: number;
  hasStripe: boolean;
  enabledModules?: string[];
  catalog?: ModuleInfo[];
}) {
  void _rest;
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const currentPlanId = currentSubscription?.plan_id as string | undefined;
  const subStatus = currentSubscription?.status as string | undefined;
  const selectedModules = currentSubscription?.selected_modules as string[] | undefined;
  const isModuleBased = !currentPlanId && !!(selectedModules ?? enabledModules)?.length;
  const monthlyAmount = Number(currentSubscription?.monthly_amount ?? 0);
  const trialEnd = currentSubscription?.trial_end as string | null;

  const statusBadge: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
    active: { label: "Actif", tone: "success" },
    trialing: { label: "Essai gratuit", tone: "info" as "neutral" },
    past_due: { label: "Paiement en retard", tone: "danger" },
    canceled: { label: "Résilié", tone: "neutral" },
    incomplete: { label: "En attente", tone: "warning" },
  };

  const moduleList = isModuleBased
    ? (catalog ?? []).filter((m) => (selectedModules ?? enabledModules ?? []).includes(m.module_key))
    : [];

  async function handlePayNow() {
    setPaying(true);
    try {
      const moduleKeys = selectedModules ?? enabledModules ?? [];
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKeys, billingInterval: "monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // silent
    } finally {
      setPaying(false);
    }
  }

  function formatPrice(price: number): string {
    if (price === 0) return "Gratuit";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 0,
    }).format(price);
  }

  return (
    <div className="space-y-6">
      {(subStatus || moduleList.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold">Abonnement actuel</h2>
              </div>
              {subStatus && (
                <Badge tone={statusBadge[subStatus]?.tone ?? "neutral"}>
                  {statusBadge[subStatus]?.label ?? subStatus}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {trialEnd && (
              <p>
                Essai gratuit jusqu&apos;au:{" "}
                <span className="font-medium">{new Date(trialEnd).toLocaleDateString("fr-FR")}</span>
              </p>
            )}
            <p>Utilisateurs: <span className="font-medium">{memberCount}</span></p>
            {monthlyAmount > 0 && (
              <p>
                Montant: <span className="font-medium">{formatPrice(monthlyAmount)}/mois</span>
              </p>
            )}
          </CardContent>
          {subStatus && ["trialing", "past_due", "canceled"].includes(subStatus) && (
            <CardContent className="border-t border-[var(--border)] pt-4">
              <Button onClick={handlePayNow} disabled={paying} className="w-full">
                {paying ? "Redirection..." : "Payer maintenant"}
              </Button>
            </CardContent>
          )}
          {moduleList.length > 0 && (
            <CardContent className="border-t border-[var(--border)] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Puzzle className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold">Modules actifs</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {moduleList.map((m) => (
                  <span
                    key={m.module_key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {m.name}
                  </span>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {hasStripe && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => router.push("/parametres/facturation")}>
            Gérer le paiement
          </Button>
        </div>
      )}

      <div>
        <h2 className="mb-4 font-semibold">Changer de formule</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const p = plan as { id: string; slug: string; name: string; description: string; price_monthly: number; max_members: number; features: string | string[] };
            const isCurrent = p.id === currentPlanId;
            const isFree = p.price_monthly === 0;

            return (
              <Card
                key={p.id}
                className={cn(
                  "relative transition",
                  isCurrent && "ring-2 ring-blue-600/20",
                )}
              >
                <CardHeader>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm text-[var(--muted)]">{p.description}</p>
                  <p className="text-2xl font-bold">
                    {isFree ? "Gratuit" : `${p.price_monthly} MAD/mois`}
                  </p>
                  {!isFree && <p className="text-xs text-[var(--muted)]">Jusqu&apos;à {p.max_members} utilisateurs</p>}
                </CardHeader>
                <CardContent>
                  <ul className="mb-4 space-y-2">
                    {(typeof p.features === "string" ? JSON.parse(p.features) : p.features ?? []).map(
                      (f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                          <span>{f}</span>
                        </li>
                      ),
                    )}
                  </ul>
                  {isCurrent && !isFree ? (
                    <Button variant="secondary" className="w-full" disabled>
                      Plan actuel
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setLoading(p.slug);
                        router.push("/parametres/facturation");
                      }}
                      disabled={loading !== null}
                      className="w-full"
                    >
                      {loading === p.slug ? "Chargement..." : isFree ? "Commencer gratuitement" : isCurrent ? "Plan actuel" : "Passer à ce plan"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

    </div>
  );
}
