"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { signInWithGoogle, type GoogleAuthMode } from "@/lib/auth/google-auth";
import { GoogleIcon } from "@/components/icons/google-icon";

const GOOGLE_ERROR_MESSAGE =
  "La connexion avec Google n'a pas pu aboutir. Réessayez ou utilisez votre email.";

export function GoogleAuthButton({
  mode,
  next,
}: {
  mode?: GoogleAuthMode;
  next?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle({ mode, next });
      // La redirection vers Google est déclenchée par Supabase Auth.
    } catch (err) {
      // Diagnostic : détail réel uniquement dans la console (jamais à l'écran).
      console.error("[google-auth] signInWithOAuth failed:", err);
      setError(GOOGLE_ERROR_MESSAGE);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        {loading ? "Redirection vers Google…" : "Continuer avec Google"}
      </button>

      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wide text-slate-400">
          ou avec votre email
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
