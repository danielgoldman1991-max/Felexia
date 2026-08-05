"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const trialBenefits = [
  "Accès immédiat au pack Essentiel",
  "Essai Essentiel sans carte bancaire",
  "Sans engagement",
  "Possibilité de choisir un abonnement plus tard",
];

const subscriptionBenefits = [
  "Choix entre Essentiel, Business et Premium",
  "Paiement mensuel ou annuel",
  "Activation immédiate après paiement",
  "Facturation sécurisée par Stripe",
  "Accès à la gestion de l'abonnement",
];

export function SubscriptionChoiceActions() {
  const router = useRouter();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartTrial() {
    if (isStartingTrial) return;

    try {
      setIsStartingTrial(true);
      setError(null);

      const response = await fetch("/api/subscriptions/start-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const payload = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        redirectTo?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Erreur activation essai : ${response.status}`);
      }

      if (!payload?.success) {
        throw new Error("L'essai n'a pas pu être activé.");
      }

      router.replace(payload.redirectTo ?? "/dashboard?trial_started=1");
      router.refresh();
    } catch (err) {
      console.error("Start trial error:", err);
      const message = err instanceof Error
        ? err.message
        : "Impossible d'activer l'essai pour le moment.";
      setError(message);
      alert(message);
    } finally {
      setIsStartingTrial(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="relative rounded-2xl border border-blue-200 bg-white p-6 shadow-xl shadow-blue-950/5">
          <div className="absolute right-5 top-5">
            <Badge tone="info">Recommandé</Badge>
          </div>
          <h2 className="pr-28 text-xl font-semibold text-slate-950">Démarrer l&apos;essai Essentiel</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Essayez Felexia avec les fonctionnalités du pack Essentiel, sans carte bancaire et sans engagement.
          </p>
          <ul className="mt-5 space-y-2">
            {trialBenefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            className="mt-6 w-full"
            onClick={handleStartTrial}
            disabled={isStartingTrial}
          >
            {isStartingTrial ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Activation en cours...
              </>
            ) : (
              "Démarrer mon essai Essentiel"
            )}
          </Button>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <h2 className="text-xl font-semibold text-slate-950">Choisir un abonnement maintenant</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sélectionnez directement le pack adapté à votre entreprise, avec paiement mensuel ou annuel sécurisé par Stripe.
          </p>
          <ul className="mt-5 space-y-2">
            {subscriptionBenefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/parametres/abonnement"
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--secondary)] shadow-[var(--shadow-sm)] transition hover:border-[#c8d0e1] hover:bg-[var(--surface-soft)]"
          >
            Voir les abonnements
          </Link>
        </article>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
