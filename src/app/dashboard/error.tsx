"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Home, RotateCcw } from "lucide-react";

/**
 * Filet de sécurité du tableau de bord (la correction principale se trouve
 * dans les guards et getters : aucun chemin de rendu ne doit lever d'erreur
 * pour un état d'organisation incomplet). N'affiche jamais de stack trace,
 * d'erreur SQL ni de digest brut comme information utilisateur.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Le digest reste côté serveur/logs — jamais affiché à l'écran.
  console.error("[dashboard] server error", {
    message: error.message,
    digest: error.digest,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow-md)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-[var(--border)]">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-[var(--foreground)]">
          Nous n&apos;avons pas pu charger votre espace.
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Une erreur inattendue est survenue. Réessayez, ou terminez la
          configuration de votre entreprise.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            Réessayer
          </button>
          <Link
            href="/onboarding/entreprise"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
          >
            Terminer la configuration
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
          >
            <Home className="h-4 w-4" />
            Revenir à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
