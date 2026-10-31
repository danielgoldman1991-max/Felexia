import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getLaunchDestination } from "@/lib/launch-profile";
import { hasFullErpAccess } from "@/lib/launch-access";

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
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
      return redirectWithSession(url, supabaseResponse);
    }

    const launchDestination = getLaunchDestination(pathname);
    if (user && launchDestination) {
      // The organisation comes from the authenticated membership, never a query
      // parameter, user metadata or a client-supplied interface preference.
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
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
