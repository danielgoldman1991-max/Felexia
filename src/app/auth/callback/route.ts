import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";
import { ensureProfileFromAuthUser } from "@/lib/auth/ensure-profile-from-auth-user";
import { resolveAuthenticatedUserRedirect } from "@/lib/auth/resolve-authenticated-user-redirect";

function redirectToLogin(requestUrl: URL, errorCode: string) {
  const url = new URL("/login", requestUrl.origin);
  url.searchParams.set("error", errorCode);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeInternalPath(requestUrl.searchParams.get("next"));

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
    // Diagnostic : message brut uniquement côté serveur (jamais exposé au client).
    console.error("[auth/callback] exchangeCodeForSession failed:", {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      next,
    });
    return redirectToLogin(requestUrl, "google_auth_failed");
  }

  const user = data.user;

  const profileResult = await ensureProfileFromAuthUser(supabase, user);

  if (!profileResult.ok) {
    if (profileResult.reason === "conflict") {
      // Conflit d'identité : on ne fusionne jamais manuellement.
      // On déconnecte l'utilisateur et on affiche un message propre.
      await supabase.auth.signOut().catch(() => {});
      return redirectToLogin(requestUrl, "account_conflict");
    }
    return redirectToLogin(requestUrl, "google_auth_failed");
  }

  const destination = await resolveAuthenticatedUserRedirect({
    supabase,
    userId: user.id,
    requestedNext: next,
  });

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
