"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { activatePlanAction } from "@/lib/actions/activate-plan";

export function SubscriptionManage({
  currentSubscription,
  plans,
  organizationId,
  memberCount,
  hasStripe,
}: {
  currentSubscription: Record<string, unknown> | null;
  plans: Record<string, unknown>[];
  organizationId: string;
  memberCount: number;
  hasStripe: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlanId = currentSubscription?.plan_id as string | undefined;
  const subStatus = currentSubscription?.status as string | undefined;

  const statusBadge: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
    active: { label: "Actif", tone: "success" },
    trialing: { label: "Essai", tone: "info" as "neutral" },
    past_due: { label: "Paiement en retard", tone: "danger" },
    canceled: { label: "Résilié", tone: "neutral" },
    incomplete: { label: "En attente", tone: "warning" },
  };

  async function handleSelectPlan(planSlug: string) {
    setLoading(planSlug);
    setError(null);

    if (hasStripe) {
      router.push("/parametres/facturation");
      setLoading(null);
      return;
    }

    const form = new FormData();
    form.set("planSlug", planSlug);
    form.set("organizationId", organizationId);
    const result = await activatePlanAction({ error: null }, form);
    if (result.error) setError(result.error);
    setLoading(null);
  }

  return (
    <div className="space-y-6">
      {currentSubscription && (
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
          <CardContent className="space-y-2 text-sm">
            <p>Utilisateurs: <span className="font-medium">{memberCount}</span></p>
          </CardContent>
        </Card>
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
                      onClick={() => handleSelectPlan(p.slug)}
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

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
    </div>
  );
}
