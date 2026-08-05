/**
 * SYNTA-IQ (synta-iq.com) company lookup provider.
 *
 * REST API: GET /api/ma/search?q=<ice_or_name>
 * Returns clean JSON with company data.
 * No CSRF, no scraping, no cheerio.
 */

import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { normalizeCompanyName, normalizeIce } from "@/lib/ice/ice";

const API_BASE = "https://www.synta-iq.com/api/ma/search";
const REQUEST_TIMEOUT_MS = 15_000;

type SyntaIqResult = {
  _s: string;
  _src: string;
  _ompicId: number;
  n: string;            // company name
  rc?: string;          // registre de commerce
  ice?: string;         // ICE number
  tribunal?: string;    // tribunal / city (may contain HTML)
  tp?: string;          // type (PM, etc.)
  fj?: string;          // forme juridique
  activity?: string;    // activité
  status?: string;      // statut (EN ACTIVITE, etc.)
  sigle?: string;
  enseigne?: string;
  capital?: string;     // capital (e.g. "100 000 DH")
};

type SyntaIqResponse = {
  results: SyntaIqResult[];
  total: number;
};

function cleanHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/<[^>]+>/g, "").trim() || null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        "user-agent":
          "FelexiaCompanyLookup/1.0 (+https://felexia.pro/bot; contact@felexia.pro)",
        accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function lookupCompanyOnSyntaIq(
  query: string,
): Promise<CompanyLookupResponse> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { status: "invalid_input", message: "Recherche vide." };
  }

  try {
    const url = `${API_BASE}?q=${encodeURIComponent(normalizedQuery)}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.warn("[company-lookup] synta-iq http error:", response.status);
      return {
        status: "unavailable",
        message: "La source externe est temporairement inaccessible.",
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      console.warn("[company-lookup] synta-iq non-json response:", contentType);
      return {
        status: "unavailable",
        message: "La source externe a retourné une réponse invalide.",
      };
    }

    const data: SyntaIqResponse = await response.json();

    if (!Array.isArray(data.results) || data.results.length === 0) {
      return {
        status: "not_found",
        message: "Aucun résultat confirmé pour cette recherche.",
      };
    }

    // For ICE queries, find exact match; for name queries, use first result
    const isIceQuery = /^\d{15}$/.test(normalizedQuery);
    const best =
      isIceQuery
        ? data.results.find((r) => normalizeIce(r.ice ?? "") === normalizedQuery) ??
          data.results[0]
        : data.results[0];

    const ice = normalizeIce(best.ice ?? "");

    const result: CompanyLookupResult = {
      source: "synta-iq",
      query: normalizedQuery,
      found: true,
      raisonSociale: best.n ? normalizeCompanyName(best.n) : null,
      ice: /^\d{15}$/.test(ice) ? ice : null,
      identifiantFiscal: null, // synta-iq doesn't provide IF
      rc: cleanHtml(best.rc) ?? null,
      villeRc: null,
      formeJuridique: cleanHtml(best.fj) ?? null,
      adresse: null,
      ville: cleanHtml(best.tribunal) ?? null,
      activite: cleanHtml(best.activity) ?? null,
      raw: best as unknown as Record<string, unknown>,
      confidence: best.n && /^\d{15}$/.test(ice) ? "high" : best.n ? "medium" : "low",
    };

    return {
      status: "found",
      message: "Entreprise trouvée.",
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("[company-lookup] synta-iq request failed:", message);
    return {
      status: "unavailable",
      message:
        "La recherche automatique n'a pas pu aboutir. Vous pouvez continuer manuellement.",
    };
  }
}
