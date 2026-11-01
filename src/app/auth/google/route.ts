import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/env";
import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";

/** Persist PKCE on the response that leaves Felexia, after hosting redirects. */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = sanitizeInternalPath(requestUrl.searchParams.get("next"));
  const mode = requestUrl.searchParams.get("mode");
  // Supabase currently allows the historical apex callback. Its hosting308
  // returns to www before Node handles the code, where this host-only cookie
  // is available. Keep this compatibility exception to the exact HTTPS pair.
  const callbackOrigin = requestUrl.origin === "https://www.felexia.pro"
    ? "https://felexia.pro"
    : requestUrl.origin;
  const callbackUrl = new URL("/auth/callback", callbackOrigin);
  callbackUrl.searchParams.set("next", next);
  if (mode === "login" || mode === "register") callbackUrl.searchParams.set("mode", mode);

  const pendingCookies = new Map<string, { value: string; options: CookieOptions }>();
  function redirect(url: URL) {
    const response = NextResponse.redirect(url);
    pendingCookies.forEach(({ value, options }, name) => response.cookies.set(name, value, options));
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }

  try {
    const { supabaseUrl, supabaseAnonKey } = requireSupabasePublicEnv();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            pendingCookies.set(name, { value, options });
          });
        },
      },
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        scopes: "openid email profile",
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw new Error("oauth_start_failed");

    const providerUrl = new URL(data.url);
    const expectedUrl = new URL("/auth/v1/authorize", supabaseUrl);
    const verifierPersisted = [...pendingCookies].some(([name, cookie]) =>
      name.endsWith("-code-verifier") && cookie.value && cookie.options.maxAge !== 0,
    );
    if (providerUrl.origin !== expectedUrl.origin || providerUrl.pathname !== expectedUrl.pathname ||
      providerUrl.searchParams.get("provider") !== "google" ||
      providerUrl.searchParams.get("redirect_to") !== callbackUrl.toString() ||
      !providerUrl.searchParams.get("code_challenge") ||
      providerUrl.searchParams.get("code_challenge_method") !== "s256" || !verifierPersisted) {
      throw new Error("oauth_start_incomplete");
    }
    return redirect(providerUrl);
  } catch {
    // No URL, code, cookie, provider error text or account detail enters logs.
    console.error("[AUTH GOOGLE START]", { step: "start", errorCode: "oauth_start_failed" });
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "google_auth_failed");
    if (next !== "/dashboard") loginUrl.searchParams.set("next", next);
    if (mode === "login" || mode === "register") loginUrl.searchParams.set("mode", mode);
    return redirect(loginUrl);
  }
}
