/**
 * Company Search Facade
 *
 * High-level API for searching Moroccan companies by ICE or name.
 * Orchestrates: cache → public company lookup form.
 */

import { createHash } from "node:crypto";
import { lookupCompany } from "@/lib/ice/company-lookup-provider";
import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { parseCompanyLookupInput } from "@/lib/ice/ice";
import { createClient } from "@/lib/supabase/server";

const FOUND_CACHE_DAYS = 30;
const NOT_FOUND_CACHE_DAYS = 7;

function hashQuery(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeCachedResult(raw: unknown): CompanyLookupResult | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const raisonSociale = typeof record.raisonSociale === "string" ? record.raisonSociale : null;

  return {
    source: (record.source as CompanyLookupResult["source"]) ?? "cache",
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
    raw: record.raw !== null && typeof record.raw === "object" ? (record.raw as Record<string, unknown>) : null,
    confidence: record.confidence === "high" || record.confidence === "medium" || record.confidence === "low" ? record.confidence : "low",
  };
}

/* ─── Cache helpers ─── */

export async function getCachedCompanySearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cacheKey: string,
  expectedIce?: string,
  expectedName?: string,
): Promise<CompanyLookupResponse | null> {
  const { data, error } = await supabase
    .from("company_lookup_cache")
    .select("results")
    .eq("query_hash", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.warn("[company-search] cache read skipped:", error.message);
    return null;
  }

  if (!Array.isArray(data?.results)) return null;
  if (data.results.length === 0) {
    // Don't serve "not_found" from cache — a more capable provider
    // might now find the company.
    return null;
  }

  const result = normalizeCachedResult(data.results[0]);
  
  // Validate the cached result has meaningful data before serving it.
  // Stale cache entries from old providers may have null fields.
  if (!result || !result.found || !result.raisonSociale || (expectedIce && result.ice !== expectedIce)) {
    return null;
  }

  // The former provider selected the first name result regardless of relevance.
  // Keep valid ICE cache hits, but re-resolve legacy name entries with the new
  // matching/ambiguity rules instead of preserving those potentially wrong hits.
  if (expectedName && (result.source !== "managepro" || result.query !== expectedName)) return null;
  
  return { status: "found", message: "Entreprise trouvée (cache).", result };
}

export async function saveCompanySearchCache(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cacheKey: string,
  normalizedQuery: string,
  queryType: "ice" | "raison_sociale",
  response: CompanyLookupResponse,
): Promise<void> {
  // Only cache successful lookups. "not_found" is not cached so that
  // provider improvements (e.g. ManagePro replacing MarocFacture) can
  // discover previously unfound companies.
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
        // Only ICE query entries occupy the unique ICE metadata index. A name
        // query has its own key; the actual identity remains intact in results.
        ice: queryType === "ice" ? response.result?.ice ?? null : null,
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

  if (error) console.warn("[company-search] cache write skipped:", error.message);
}

/* ─── Main search ─── */

export type CompanySearchInput = {
  query: string;
};

export type CompanySearchOutput = CompanyLookupResponse & {
  cached?: boolean;
};

/**
 * Search for a company by ICE or name.
 * Flow: cache → public company lookup form.
 */
export async function searchCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: CompanySearchInput,
): Promise<CompanySearchOutput> {
  const query = input.query.trim();

  if (!query) {
    return { status: "invalid_input", message: "La recherche est vide." };
  }

  if (query.length > 120) {
    return { status: "invalid_input", message: "La recherche est trop longue." };
  }

  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) {
    return { status: "invalid_input", message: parsed.error ?? "Recherche invalide." };
  }

  // Earlier name matching could keep one result where the new matching rules
  // offer several choices. Do not let those entries hide the candidate list.
  const cacheNamespace = parsed.type === "raison_sociale" ? "name-candidates-v2:" : "";
  const cacheKey = hashQuery(`${cacheNamespace}${parsed.type}:${parsed.normalizedValue}`);
  const cached = await getCachedCompanySearch(
    supabase, cacheKey,
    parsed.type === "ice" ? parsed.normalizedValue : undefined,
    parsed.type === "raison_sociale" ? parsed.normalizedValue : undefined,
  );
  if (cached) {
    return { ...cached, cached: true };
  }

  const response = await lookupCompany(parsed.normalizedValue);

  await saveCompanySearchCache(supabase, cacheKey, parsed.normalizedValue, parsed.type, response);

  return response;
}
