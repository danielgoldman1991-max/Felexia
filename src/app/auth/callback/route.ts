import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";
import { ensureProfileFromAuthUser } from "@/lib/auth/ensure-profile-from-auth-user";
import { resolveAuthenticatedUserRedirect } from "@/lib/auth/resolve-authenticated-user-redirect";
import { allowPasswordRecovery } from "@/lib/auth/recovery-session";

function redirectResponse(url: URL) {
  return NextResponse.redirect(url, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function redirectToLogin(requestUrl: URL, errorCode: string) {
  const url = new URL("/login", requestUrl.origin);
  url.searchParams.set("error", errorCode);
  const next = sanitizeInternalPath(requestUrl.searchParams.get("next"));
  if (next !== "/dashboard") url.searchParams.set("next", next);
  const mode = requestUrl.searchParams.get("mode");
  if (mode === "login" || mode === "register") url.searchParams.set("mode", mode);
  return redirectResponse(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeInternalPath(requestUrl.searchParams.get("next"));
  const isRecovery = requestUrl.searchParams.get("recovery") === "1" || requestUrl.searchParams.get("type") === "recovery";

  if (isRecovery) {
    if (requestUrl.searchParams.has("error")) return redirectResponse(new URL("/reinitialiser-mot-de-passe", requestUrl.origin));
    const supabase = await createClient();
    const tokenHash = requestUrl.searchParams.get("token_hash");
    const result = tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : code ? await supabase.auth.exchangeCodeForSession(code) : null;
    if (result && !result.error && result.data.user) await allowPasswordRecovery(result.data.user.id);
    return redirectResponse(new URL("/reinitialiser-mot-de-passe", requestUrl.origin));
  }

  // Erreur remontée par le fournisseur OAuth (annulation, refus, etc.)
  if (requestUrl.searchParams.has("error")) {
    const providerError = requestUrl.searchParams.get("error");
    const errorCode =
      providerError === "access_denied" ? "access_denied" : "google_auth_failed";
    return redirectToLogin(requestUrl, errorCode);
  }

  if (!code) {
    return redirectToLogin(requestUrl, "missing_oauth_code");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    // Logs structurés, sans données sensibles (jamais de token/code/cookies).
    console.error("[AUTH CALLBACK]", {
      step: "exchange",
      errorCode: error?.code,
      errorMessage: error?.message,
    });
    return redirectToLogin(requestUrl, "google_auth_failed");
  }

  const user = data.user;

  try {
    // 1. Synchronisation du profil public (idempotente, fill-only-empty).
    const profileResult = await ensureProfileFromAuthUser(supabase, user);

    if (!profileResult.ok) {
      console.error("[AUTH CALLBACK]", {
        step: "profile",
        userId: user.id,
        reason: profileResult.reason,
        errorMessage: profileResult.message ?? undefined,
      });
      if (profileResult.reason === "conflict") {
        // Conflit d'identité : on ne fusionne jamais manuellement.
        // On déconnecte l'utilisateur et on affiche un message propre.
        await supabase.auth.signOut().catch(() => {});
        return redirectToLogin(requestUrl, "account_conflict");
      }
      return redirectToLogin(requestUrl, "google_auth_failed");
    }

    // 2. Destination : onboarding entreprise si aucune organisation,
    // sinon dashboard / next interne (jamais /dashboard en dur).
    const destination = await resolveAuthenticatedUserRedirect({
      supabase,
      userId: user.id,
      requestedNext: next,
    });

    console.info("[AUTH CALLBACK]", {
      step: "destination",
      userId: user.id,
      destination,
    });

    return redirectResponse(new URL(destination, requestUrl.origin));
  } catch (caught) {
    console.error("[AUTH CALLBACK] post-auth failed", {
      step: "error",
      userId: user.id,
      errorMessage: caught instanceof Error ? caught.message : "unknown",
    });
    return redirectToLogin(requestUrl, "oauth_profile_initialization_failed");
  }
}
