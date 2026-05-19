"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompleteOnboardingButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompleteOnboarding() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Impossible d'accéder au tableau de bord.");
      }

      router.replace(payload.redirectTo ?? "/dashboard?skipWelcome=1");
    } catch (completeError) {
      setIsLoading(false);
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Impossible d'accéder au tableau de bord pour le moment.",
      );
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={handleCompleteOnboarding}
        disabled={isLoading}
        aria-busy={isLoading}
        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Ouverture du tableau de bord..." : "Accéder au tableau de bord"}
      </button>
      {error ? <p className="max-w-xs text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
