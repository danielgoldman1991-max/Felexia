"use client";

import { createClient } from "@/lib/supabase/client";
import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";

export type GoogleAuthMode = "login" | "register";

export type SignInWithGoogleOptions = {
  next?: string;
  mode?: GoogleAuthMode;
};

/**
 * Démarre le flux OAuth Google via Supabase Auth (côté navigateur).
 *
 * - Aucun secret Google côté client (le Provider est configuré dans le
 *   dashboard Supabase) ;
 * - `redirectTo` pointe toujours vers `/auth/callback` (URL absolue issue
 *   de l'origin courante) — elle doit être présente dans la liste des
 *   "Redirect URLs" de la config Supabase ;
 * - `next` est sanitizé (anti open-redirect).
 */
export async function signInWithGoogle(options?: SignInWithGoogleOptions) {
  const supabase = createClient();

  const next = sanitizeInternalPath(options?.next ?? "/dashboard");
  const callbackUrl = new URL("/auth/callback", window.location.origin);

  callbackUrl.searchParams.set("next", next);

  if (options?.mode) {
    callbackUrl.searchParams.set("mode", options.mode);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: "openid email profile",
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
