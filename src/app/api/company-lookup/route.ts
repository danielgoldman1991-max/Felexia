import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { lookupCompany, type CompanyLookupResponse, type CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { parseCompanyLookupInput } from "@/lib/ice/ice";
import { createClient } from "@/lib/supabase/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const FOUND_CACHE_DAYS = 30;
const NOT_FOUND_CACHE_DAYS = 7;

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getWindowStart(date = new Date()): Date {
  return new Date(Math.floor(date.getTime() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS);
}

function jsonResponse(payload: CompanyLookupResponse, status = 200) {
  return NextResponse.json(payload, { status });
}

async function enforceRateLimit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const now = new Date();
  const windowStart = getWindowStart(now);
  const id = `${userId}:${windowStart.toISOString()}`;

  const { error: writeError } = await supabase
    .from("company_lookup_rate_limits")
    .upsert(
      {
        id,
        user_id: userId,
        window_start: windowStart.toISOString(),
        request_count: 1,
        updated_at: now.toISOString(),
      },
      { onConflict: "id" },
  );

  if (writeError) console.warn("[company-lookup] rate-limit write skipped:", writeError.message);
  return true;
}

function normalizeCachedResult(raw: unknown): CompanyLookupResult | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const raisonSociale = typeof record.raisonSociale === "string" ? record.raisonSociale : null;

  return {
    source: "cache",
    query: typeof record.query === "string" ? record.query : "",
    found: Boolean(record.found),
    raisonSociale,
    ice: typeof record.ice === "string" ? record.ice : null,
    identifiantFiscal: typeof record.identifiantFiscal === "string" ? record.identifiantFiscal : null,
    rc: typeof record.rc === "string" ? record.rc : null,
    villeRc: typeof record.villeRc === "string" ? record.villeRc : null,
    formeJuridique: typeof record.formeJuridique === "string" ? record.formeJuridique : null,
    adresse: typeof record.adresse === "string" ? record.adresse : null,
    ville: typeof record.ville === "string" ? record.ville : null,
    activite: typeof record.activite === "string" ? record.activite : null,
    confidence: record.confidence === "high" || record.confidence === "medium" || record.confidence === "low" ? record.confidence : "low",
  };
}

async function getCachedResponse(supabase: Awaited<ReturnType<typeof createClient>>, cacheKey: string): Promise<CompanyLookupResponse | null> {
  const { data, error } = await supabase
    .from("company_lookup_cache")
    .select("results")
    .eq("query_hash", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.warn("[company-lookup] cache read skipped:", error.message);
    return null;
  }

  if (!Array.isArray(data?.results)) return null;
  if (data.results.length === 0) {
    return null; // don't serve stale "not_found" — providers may improve
  }

  const result = normalizeCachedResult(data.results[0]);
  return result ? { status: "found", message: "Entreprise trouvée.", result } : null;
}

async function saveCachedResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cacheKey: string,
  normalizedQuery: string,
  queryType: "ice" | "raison_sociale",
  response: CompanyLookupResponse,
) {
  // Only cache successful lookups so provider improvements can find companies
  if (response.status !== "found") return;

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + (response.status === "found" ? FOUND_CACHE_DAYS : NOT_FOUND_CACHE_DAYS));

  const { error } = await supabase
    .from("company_lookup_cache")
    .upsert(
      {
        query_hash: cacheKey,
        normalized_query: normalizedQuery,
        query_type: queryType,
        source: response.result?.source ?? "unknown",
        results: response.status === "found" && response.result ? [response.result] : [],
        ice: response.result?.ice ?? null,
        raison_sociale: response.result?.raisonSociale ?? null,
        rc: response.result?.rc ?? null,
        if_number: response.result?.identifiantFiscal ?? null,
        adresse: response.result?.adresse ?? null,
        ville: response.result?.ville ?? null,
        status: response.status,
        error_message: response.status === "found" ? null : response.message,
        confidence_score: response.result?.confidence === "high" ? 90 : response.result?.confidence === "medium" ? 60 : 30,
        raw_data: response.result?.raw ?? null,
        last_checked_at: now.toISOString(),
        fetched_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "query_hash" },
    );

  if (error) console.warn("[company-lookup] cache write skipped:", error.message);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse({ status: "unavailable", message: "Session expirée. Veuillez vous reconnecter." }, 401);
  }

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  console.log("[company-lookup] query:", query);
  console.log("[company-lookup] mode:", "marocfacture");

  if (!query) {
    return jsonResponse({ status: "invalid_input", message: "La recherche est vide." }, 400);
  }

  if (query.length > 120) {
    return jsonResponse({ status: "invalid_input", message: "La recherche est trop longue." }, 400);
  }

  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) {
    return jsonResponse({ status: "invalid_input", message: parsed.error ?? "Recherche invalide." }, 400);
  }

  await enforceRateLimit(supabase, user.id);

  const cacheKey = hashValue(`${parsed.type}:${parsed.normalizedValue}`);
  const cached = await getCachedResponse(supabase, cacheKey);
  if (cached) {
    console.log("[company-lookup] results count:", cached.status === "found" ? 1 : 0);
    return jsonResponse(cached);
  }

  try {
    const response = await lookupCompany(parsed.normalizedValue);
    console.log("[company-lookup] results count:", response.status === "found" ? 1 : 0);
    await saveCachedResponse(supabase, cacheKey, parsed.normalizedValue, parsed.type, response);
    return jsonResponse(response, response.status === "invalid_input" ? 400 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[company-lookup] error:", message);
    return jsonResponse({
      status: "unavailable",
      message: "La recherche automatique n’a pas pu aboutir. Vous pouvez continuer manuellement avec les informations dont vous disposez.",
    }, 502);
  }
}
