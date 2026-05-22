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

/* ─── Validation ─── */

const searchSchema = z.object({
  query: z
    .string()
    .min(1, "La recherche est vide.")
    .max(120, "La recherche est trop longue.")
    .transform((v) => v.trim()),
});

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

  /* 3. Search */
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
