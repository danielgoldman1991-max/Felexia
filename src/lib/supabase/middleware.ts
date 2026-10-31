import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getLaunchDestination } from "@/lib/launch-profile";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { getOperatorDestination, isOperatorPathAllowed, isOperatorRole, OPERATOR_ACCESS_ERROR } from "@/lib/auth/operator-access";
import { hasValidSubscriptionAccess, SUBSCRIPTION_READ_ONLY_MESSAGE } from "@/lib/subscriptions/subscription-access";

const SESSION_CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

function redirectWithSession(
  url: URL,
  sessionResponse: NextResponse,
): NextResponse {
  const response = NextResponse.redirect(url);

  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  SESSION_CACHE_HEADERS.forEach((headerName) => {
    const value = sessionResponse.headers.get(headerName);
    if (value) response.headers.set(headerName, value);
  });

  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const env = getEnv();

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) => {
            supabaseResponse.headers.set(name, value);
          });
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;

  // Public landing page: `/` is always accessible, for logged-in AND anonymous
  // visitors. Never redirect `/` to /login or /dashboard.
  if (pathname === "/") {
    return supabaseResponse;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && pathname !== "/login") {
      if (pathname.startsWith("/api/")) {
        const response = NextResponse.json({ error: "Non authentifié." }, { status: 401, headers: { "Cache-Control": "no-store" } });
        supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        return response;
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
      return redirectWithSession(url, supabaseResponse);
    }

    const { data: activeMembership, error: membershipError } = user ? await supabase.from("organization_members")
      .select("organization_id, role:roles(name)").eq("user_id", user.id).eq("status", "active")
      .limit(1).maybeSingle() : { data: null, error: null };
    const activeRole = Array.isArray(activeMembership?.role) ? activeMembership.role[0] : activeMembership?.role;
    const requestedPath = `${pathname}${request.nextUrl.search}`;
    if (user && isOperatorRole(activeRole?.name) && !isOperatorPathAllowed(requestedPath, request.method)) {
      if (request.method !== "GET" && request.method !== "HEAD" || pathname.startsWith("/api/")) {
        const response = NextResponse.json({ error: OPERATOR_ACCESS_ERROR, code: "OPERATOR_ACCESS_DENIED" },
          { status: 403, headers: { "Cache-Control": "no-store" } });
        supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        return response;
      }
      const url = request.nextUrl.clone();
      url.pathname = getOperatorDestination(requestedPath) ?? "/dashboard";
      url.search = "";
      return redirectWithSession(url, supabaseResponse);
    }

    // Database RLS is the authority. This guard also keeps read-only members
    // out of forms that they cannot submit, including Server Action POSTs.
    const mutationRequest = request.method !== "GET" && request.method !== "HEAD";
    const mutationForm = /\/(?:new|nouveau|edit|modifier|paiement|affecter|affectations?)(?:\/|$)/i.test(pathname);
    const personalSettings = ["/parametres/profil", "/parametres/preferences", "/parametres/securite"]
      .includes(pathname.replace(/\/+$/, ""));
    if (user && (mutationRequest || mutationForm)) {
      if (membershipError || (isReadOnlyRole(activeRole?.name) && !personalSettings)) {
        if (mutationRequest) {
          const response = NextResponse.json(
            { error: "Votre accès est en lecture seule. Contactez votre administrateur pour modifier ces données.", code: "READ_ONLY_ACCESS" },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
          return response;
        }
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return redirectWithSession(url, supabaseResponse);
      }
    }

    const businessPath = /^\/(?:facturation|achats|tiers|tresorerie|articles)(?:\/|$)/.test(pathname)
      || pathname.startsWith("/comptabilite/ecritures");
    if (user && activeMembership?.organization_id && businessPath && (mutationRequest || mutationForm)) {
      const { data: subscription, error: subscriptionError } = await supabase
        .from("organization_subscriptions")
        .select("status, trial_ends_at, trial_end, current_period_end")
        .eq("organization_id", activeMembership.organization_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (subscriptionError || !hasValidSubscriptionAccess(subscription)) {
        if (mutationRequest) {
          const response = NextResponse.json(
            { error: SUBSCRIPTION_READ_ONLY_MESSAGE, code: "SUBSCRIPTION_WRITE_REQUIRED" },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
          return response;
        }
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "?notice=subscription_read_only";
        return redirectWithSession(url, supabaseResponse);
      }
    }

    const launchDestination = pathname.startsWith("/api/") ? null : getLaunchDestination(requestedPath);
    if (user && launchDestination) {
      // The organisation comes from the authenticated membership, never a query
      // parameter, user metadata or a client-supplied interface preference.
      const membership = activeMembership;
      const fullAccess = membership?.organization_id
        ? await hasFullErpAccess(membership.organization_id)
        : false;
      if (!fullAccess) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          const response = NextResponse.json(
            { error: "Ce module est disponible sur demande.", code: "MODULE_ON_REQUEST" },
            { status: 403 },
          );
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
          return response;
        }
        const url = request.nextUrl.clone();
        url.pathname = membership ? launchDestination : "/onboarding/entreprise";
        url.search = "";
        return redirectWithSession(url, supabaseResponse);
      }
    }

    return supabaseResponse;
  } catch {
    if (pathname !== "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
      return redirectWithSession(url, supabaseResponse);
    }
    return supabaseResponse;
  }
}
