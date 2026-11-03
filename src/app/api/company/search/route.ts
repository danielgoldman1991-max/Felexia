/**
 * POST /api/company/search
 *
 * Intelligent company lookup by ICE or company name.
 *
 * Flow:
 *   1. Zod validation
 *   2. Cache lookup (Supabase)
 *   3. Company lookup provider
 *   4. Cache save
 *
 * Response types match CompanyLookupResponse for compatibility
 * with the existing onboarding UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchCompany } from "@/lib/company-search";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { parseCompanyLookupInput } from "@/lib/ice/ice";

/* ─── Validation ─── */

const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "La recherche est vide.")
    .max(100, "Utilisez l’ICE ou une raison sociale de 100 caractères maximum."),
});

/* ─── Helpers ─── */

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/* ─── Route ─── */

export async function POST(request: NextRequest) {
  /* 1. Auth */
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(
      { status: "unavailable", message: "Session expirée. Veuillez vous reconnecter." },
      401,
    );
  }

  /* 2. Validate before charging a valid lookup against its quota. */
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
  const lookupInput = parseCompanyLookupInput(query);
  if (!lookupInput.isValid) {
    return jsonResponse({ status: "invalid_input", message: lookupInput.error ?? "Recherche invalide." }, 400);
  }

  /* 3. Allow normal ICE/name corrections without a mandatory delay between
   * attempts. Keep both a short burst bound and an hourly bound per user.
   * Namespaces isolate this policy from other routes and the former 1/30s key.
   */
  for (const [window, count, milliseconds] of [
    ["minute", 10, 60_000],
    ["hour", 60, 3_600_000],
  ] as const) {
    const limit = isRateLimited(`company-search:${window}:${user.id}`, count, milliseconds);
    if (!limit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return NextResponse.json({
        status: "rate_limited",
        message: `Limite de recherches atteinte. Réessayez dans ${retryAfterSeconds} secondes.`,
        retryAfterSeconds,
      }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "private, no-store" } });
    }
  }

  /* 4. Search */
  try {
    const response = await searchCompany(supabase, { query: lookupInput.normalizedValue });
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
