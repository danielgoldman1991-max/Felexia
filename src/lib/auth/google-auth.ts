"use client";

import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";

export type GoogleAuthMode = "login" | "register";

export type SignInWithGoogleOptions = {
  next?: string;
  mode?: GoogleAuthMode;
};

/**
 * Opens the same-origin server entry point before creating the PKCE verifier.
 *
 * - Aucun secret Google côté client (le Provider est configuré dans le
 *   dashboard Supabase) ;
 * - the server persists the verifier in the redirect response, rather than
 *   relying on a client-side cookie write before leaving the page;
 * - any hosting redirect happens before that cookie is created;
 * - `next` est sanitizé (anti open-redirect).
 */
export async function signInWithGoogle(options?: SignInWithGoogleOptions) {
  const next = sanitizeInternalPath(options?.next ?? "/dashboard");
  const startUrl = new URL("/auth/google", window.location.origin);
  startUrl.searchParams.set("next", next);

  if (options?.mode === "login" || options?.mode === "register") {
    startUrl.searchParams.set("mode", options.mode);
  }

  window.location.assign(startUrl.toString());
  return { provider: "google" as const, url: startUrl.toString() };
}
