import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache", Expires: "0" };
const FAILURE_MESSAGE = "La déconnexion n'a pas pu être confirmée. Réessayez dans quelques instants.";

/** Session self-service: independent of company role, plan and financial routes. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
    return NextResponse.json({ error: "Origine de la demande non autorisée." }, { status: 403, headers: NO_STORE });
  }

  const response = NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303, headers: NO_STORE });
  try {
    const { supabaseUrl, supabaseAnonKey } = requireSupabasePublicEnv();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      console.error("[auth] local sign-out failed", { code: error.code });
      const failure = NextResponse.json({ error: FAILURE_MESSAGE }, { status: 503, headers: NO_STORE });
      for (const cookie of response.cookies.getAll()) failure.cookies.set(cookie);
      return failure;
    }
    response.cookies.delete("felexia_recovery");
    return response;
  } catch {
    console.error("[auth] local sign-out unavailable");
    const failure = NextResponse.json({ error: FAILURE_MESSAGE }, { status: 503, headers: NO_STORE });
    for (const cookie of response.cookies.getAll()) failure.cookies.set(cookie);
    return failure;
  }
}

/** GET, including link prefetches, never changes authentication state. */
export function GET() {
  return NextResponse.json({ error: "Utilisez le bouton « Se déconnecter »." }, { status: 405, headers: { ...NO_STORE, Allow: "POST" } });
}
