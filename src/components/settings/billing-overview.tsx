"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ExternalLink, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type SubscriptionInfo = {
  id: string;
  planName: string;
  planSlug: string;
  status: string;
  billingInterval: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  canceledAt: string | null;
  stripeSubscriptionId: string | null;
};

export function BillingOverview({
  stripeCustomerId,
  subscription,
  hasStripe,
}: {
  stripeCustomerId: string | null;
  subscription: SubscriptionInfo | null;
  hasStripe: boolean;
}) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: "Actif", color: "text-green-600 bg-green-50" },
    past_due: { label: "Paiement en retard", color: "text-red-600 bg-red-50" },
    canceled: { label: "Resilie", color: "text-slate-600 bg-slate-100" },
    unpaid: { label: "Impaye", color: "text-red-600 bg-red-50" },
    trialing: { label: "Essai actif", color: "text-blue-600 bg-blue-50" },
    trial: { label: "Essai actif", color: "text-blue-600 bg-blue-50" },
    incomplete: { label: "En attente", color: "text-amber-600 bg-amber-50" },
  };

  async function handlePortal() {
    if (!hasStripe || !stripeCustomerId) return;
    setLoadingPortal(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingPortal(false);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const statusInfo = subscription
    ? statusLabels[subscription.status] || { label: subscription.status, color: "text-slate-600 bg-slate-100" }
    : null;

  return (
    <div className="space-y-6">
      {!subscription ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Aucun abonnement actif</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Vous navez pas encore souscrit a une formule. Choisissez un plan pour commencer.
              </p>
              <Button className="mt-4" onClick={() => router.push("/parametres/abonnement")}>
                Voir les formules
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{subscription.planName}</h3>
                  {statusInfo && (
                    <span
                      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}
                    >
                      {subscription.status === "active" ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {statusInfo.label}
                    </span>
                  )}
                  <div className="mt-4 space-y-1 text-sm text-[var(--muted)]">
                    <p>
                      Facturation:{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        {subscription.billingInterval === "yearly" ? "Annuelle" : "Mensuelle"}
                      </span>
                    </p>
                    {subscription.currentPeriodEnd && (
                      <p>
                        Prochaine echeance:{" "}
                        <span className="font-medium text-[var(--foreground)]">
                          {formatDate(subscription.currentPeriodEnd)}
                        </span>
                      </p>
                    )}
                    {subscription.trialEnd && (
                      <p>
                        Fin de l&apos;essai:{" "}
                        <span className="font-medium text-[var(--foreground)]">
                          {formatDate(subscription.trialEnd)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hasStripe && stripeCustomerId && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h3 className="mb-4 font-semibold">Gestion de l&apos;abonnement</h3>
              <p className="mb-4 text-sm text-[var(--muted)]">
                Accedez au portail Stripe pour modifier votre moyen de paiement, telecharger vos factures ou resilier.
              </p>
              <Button onClick={handlePortal} disabled={loadingPortal} variant="secondary">
                {loadingPortal ? (
                  "Chargement..."
                ) : (
                  <>
                    Portail de paiement
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
