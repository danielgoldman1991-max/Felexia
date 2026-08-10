import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

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
