/**
 * POST /api/company/search
 *
 * Intelligent company lookup by ICE or company name.
 *
 * Flow:
 *   1. Zod validation
 *   2. IP-based rate limit (1 req / 30s)
 *   3. User-based rate limit (10 req / 60s)
 *   4. Cache lookup (Supabase)
 *   5. Welipro scrape (primary)
 *   6. MarocFacture fallback
 *   7. Cache save
 *
 * Response types match CompanyLookupResponse for compatibility
 * with the existing onboarding UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchCompany } from "@/lib/company-search";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/* ─── Validation ─── */

const searchSchema = z.object({
  query: z
    .string()
    .min(1, "La recherche est vide.")
    .max(120, "La recherche est trop longue.")
    .transform((v) => v.trim()),
});

/* ─── Rate limits ─── */

const IP_RATE_MAX = 1;
const IP_RATE_WINDOW_MS = 30_000;

const USER_RATE_MAX = 10;
const USER_RATE_WINDOW_MS = 60_000;

/* ─── Helpers ─── */

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, { status });
}

/* ─── Route ─── */

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  /* 1. Auth */
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(
      { status: "unavailable", message: "Session expirée. Veuillez vous reconnecter." },
      401,
    );
  }

  /* 2. Body validation */
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ status: "invalid_input", message: "Corps de requête invalide." }, 400);
  }

  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Requête invalide.";
    return jsonResponse({ status: "invalid_input", message: firstError }, 400);
  }

  const { query } = parsed.data;
  console.log("[api/company/search] query:", query, "user:", user.id);

  /* 3. IP rate limit */
  const clientIp = getClientIp(request);
  const ipLimit = isRateLimited(`ip:${clientIp}`, IP_RATE_MAX, IP_RATE_WINDOW_MS);
  if (!ipLimit.allowed) {
    console.warn("[api/company/search] IP rate limited:", clientIp);
    return jsonResponse(
      { status: "blocked", message: "Trop de recherches rapprochées. Réessayez dans quelques instants." },
      429,
    );
  }

  /* 4. User rate limit (persistent, via Supabase) */
  const userAllowed = await enforceUserRateLimit(supabase, user.id);
  if (!userAllowed) {
    return jsonResponse(
      { status: "blocked", message: "Quota de recherches atteint. Réessayez dans une minute." },
      429,
    );
  }

  /* 5. Search */
  try {
    const response = await searchCompany(supabase, { query });
    const duration = Date.now() - startTime;
    console.log("[api/company/search] result:", response.status, "duration:", duration, "ms");
    return jsonResponse(response, response.status === "invalid_input" ? 400 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/company/search] unexpected error:", message);
    return jsonResponse(
      {
        status: "unavailable",
        message: "La recherche automatique n’a pas pu aboutir. Vous pouvez continuer manuellement.",
      },
      502,
    );
  }
}

/* ─── Persistent user rate limit ─── */

async function enforceUserRateLimit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / USER_RATE_WINDOW_MS) * USER_RATE_WINDOW_MS);
  const id = `${userId}:${windowStart.toISOString()}`;

  const { data: current, error: readError } = await supabase
    .from("company_lookup_rate_limits")
    .select("request_count")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    console.warn("[api/company/search] user rate-limit read skipped:", readError.message);
    return true; // graceful degradation
  }

  const nextCount = Number(current?.request_count ?? 0) + 1;
  if (nextCount > USER_RATE_MAX) return false;

  const { error: writeError } = await supabase
    .from("company_lookup_rate_limits")
    .upsert(
      {
        id,
        user_id: userId,
        window_start: windowStart.toISOString(),
        request_count: nextCount,
        updated_at: now.toISOString(),
      },
      { onConflict: "id" },
    );

  if (writeError) console.warn("[api/company/search] user rate-limit write skipped:", writeError.message);
  return true;
}
