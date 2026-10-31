import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let databaseReady = false;
  try {
    const { supabaseUrl, supabaseAnonKey } = requireSupabasePublicEnv();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await supabase
      .from("subscription_plans")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(5000));
    databaseReady = !error;
    if (error) console.error("[HEALTH] database probe failed", { code: error.code });
  } catch {
    console.error("[HEALTH] database probe unavailable");
  }
  return Response.json(
    {
      status: databaseReady ? "ok" : "unavailable",
      app: "FelexiaERP",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      checks: { database: databaseReady ? "ok" : "unavailable" },
    },
    {
      status: databaseReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
