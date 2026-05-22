import {
  normalizeCompanyName,
  normalizeIce,
  parseCompanyLookupInput,
} from "@/lib/ice/ice";
import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";

const MAROC_FACTURE_ICE_URL = "https://ice.marocfacture.com/";
const REQUEST_TIMEOUT_MS = 6_000;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function compact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = decodeHtml(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function containsBlockedMarker(html: string): boolean {
  return /captcha|cloudflare|attention required|access denied|forbidden|verification|challenge/i.test(html);
}

function containsExplicitNoResult(html: string): boolean {
  return /aucun résultat|aucun resultat|aucun enregistrement|introuvable|non trouvé|non trouve|no result|not found/i.test(stripTags(html));
}

function resultFromRecord(record: Record<string, unknown>, query: string): CompanyLookupResult | null {
  const raisonSociale = compact(record.raisonSociale)
    ?? compact(record.raison_sociale)
    ?? compact(record.nom)
    ?? compact(record.name)
    ?? compact(record.companyName);
  const ice = normalizeIce(String(record.ice ?? record.ICE ?? ""));

  if (!raisonSociale && !ice) return null;

  return {
    source: "marocfacture",
    query,
    found: true,
    raisonSociale: raisonSociale ? normalizeCompanyName(raisonSociale) : null,
    ice: /^\d{15}$/.test(ice) ? ice : null,
    identifiantFiscal: compact(record.identifiantFiscal) ?? compact(record.if) ?? compact(record.IF),
    rc: compact(record.rc) ?? compact(record.RC),
    villeRc: compact(record.villeRc) ?? compact(record.ville_rc),
    formeJuridique: compact(record.formeJuridique) ?? compact(record.forme_juridique),
    adresse: compact(record.adresse) ?? compact(record.address),
    ville: compact(record.ville) ?? compact(record.city),
    activite: compact(record.activite) ?? compact(record.activity),
    raw: record,
    confidence: raisonSociale && /^\d{15}$/.test(ice) ? "high" : "medium",
  };
}

function parseJsonResult(raw: unknown, query: string): CompanyLookupResult | null {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "object" && item !== null) {
        const parsed = resultFromRecord(item as Record<string, unknown>, query);
        if (parsed) return parsed;
      }
    }
    return null;
  }

  if (typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    const nested = record.result ?? record.results ?? record.data ?? record.company;
    if (nested) return parseJsonResult(nested, query);
    return resultFromRecord(record, query);
  }

  return null;
}

function parseHtmlTables(html: string, query: string): CompanyLookupResult | null {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) => stripTags(match[1]));
    const ice = normalizeIce(cells.find((cell) => /\d{15}/.test(cell)) ?? "");
    const name = cells.find((cell) => cell.length > 2 && !/\d{15}/.test(cell) && !/^(ice|nom|raison sociale|rc|ville|adresse)$/i.test(cell));

    if (!/^\d{15}$/.test(ice) || !name) continue;

    return {
      source: "marocfacture",
      query,
      found: true,
      raisonSociale: normalizeCompanyName(name),
      ice,
      adresse: compact(cells.find((cell) => /adresse/i.test(cell))?.replace(/^adresse[:\s]*/i, "")),
      ville: compact(cells.find((cell) => /^ville[:\s]/i.test(cell))?.replace(/^ville[:\s]*/i, "")),
      rc: compact(cells.find((cell) => /^rc[:\s]/i.test(cell))?.replace(/^rc[:\s]*/i, "")),
      raw: { cells },
      confidence: "medium",
    };
  }

  return null;
}

function parseLooseText(html: string, query: string): CompanyLookupResult | null {
  const text = stripTags(html);
  const ice = normalizeIce(text.match(/\b\d{15}\b/)?.[0] ?? "");
  if (!/^\d{15}$/.test(ice)) return null;

  const index = text.indexOf(ice);
  const before = text.slice(Math.max(0, index - 180), index).trim();
  const name = before.split(/(?:ICE|Identifiant|RC|Ville|Adresse|Recherche|Nom)/i).pop()?.trim();

  if (!name || name.length < 3) {
    return {
      source: "marocfacture",
      query,
      found: true,
      ice,
      raw: { preview: text.slice(Math.max(0, index - 180), Math.min(text.length, index + 180)) },
      confidence: "low",
    };
  }

  return {
    source: "marocfacture",
    query,
    found: true,
    raisonSociale: normalizeCompanyName(name),
    ice,
    raw: { preview: text.slice(Math.max(0, index - 180), Math.min(text.length, index + 180)) },
    confidence: "low",
  };
}

export function parseMarocFactureResult(htmlOrJson: unknown, query: string): CompanyLookupResponse {
  if (typeof htmlOrJson !== "string") {
    const jsonResult = parseJsonResult(htmlOrJson, query);
    if (jsonResult) return { status: "found", message: "Entreprise trouvée.", result: jsonResult };
    return {
      status: "unavailable",
      message: "Felexia n’a pas pu interpréter la réponse de la source externe.",
    };
  }

  const html = htmlOrJson;
  if (containsBlockedMarker(html)) {
    return {
      status: "blocked",
      message: "La source externe ne permet pas la récupération automatique actuellement.",
    };
  }

  const tableResult = parseHtmlTables(html, query);
  if (tableResult) return { status: "found", message: "Entreprise trouvée.", result: tableResult };

  const looseResult = parseLooseText(html, query);
  if (looseResult) return { status: "found", message: "Entreprise trouvée.", result: looseResult };

  if (containsExplicitNoResult(html)) {
    return {
      status: "not_found",
      message: "Aucun résultat confirmé pour cette recherche.",
    };
  }

  return {
    status: "unavailable",
    message: "Felexia n’a pas pu confirmer automatiquement cette entreprise. Vous pouvez continuer manuellement avec l’ICE prérempli.",
  };
}

function buildSearchAttempts(query: string, type: "ice" | "raison_sociale"): Array<{ label: string; url: string; init?: RequestInit }> {
  const encoded = encodeURIComponent(query);
  const fieldName = type === "ice" ? "ice" : "nom";

  return [
    { label: `get_${fieldName}`, url: `${MAROC_FACTURE_ICE_URL}?${fieldName}=${encoded}` },
    { label: "get_query", url: `${MAROC_FACTURE_ICE_URL}?query=${encoded}` },
    { label: "get_q", url: `${MAROC_FACTURE_ICE_URL}?q=${encoded}` },
    {
      label: `post_${fieldName}`,
      url: MAROC_FACTURE_ICE_URL,
      init: {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ [fieldName]: query }).toString(),
      },
    },
    {
      label: "post_query",
      url: MAROC_FACTURE_ICE_URL,
      init: {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query }).toString(),
      },
    },
  ];
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      headers: {
        "user-agent": "FelexiaCompanyLookup/1.0",
        "accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function lookupCompanyOnMarocFacture(query: string): Promise<CompanyLookupResponse> {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) {
    return {
      status: "invalid_input",
      message: parsed.error ?? "Recherche invalide.",
    };
  }

  const normalizedQuery = parsed.normalizedValue;
  console.log("[company-lookup] calling marocfacture...");

  let lastPreview = "";

  for (const attempt of buildSearchAttempts(normalizedQuery, parsed.type)) {
    try {
      const response = await fetchWithTimeout(attempt.url, attempt.init);
      const contentType = response.headers.get("content-type") ?? "";
      const raw = contentType.includes("application/json") ? await response.json() : await response.text();

      if (!response.ok) {
        console.warn("[company-lookup] marocfacture http error:", attempt.label, response.status);
        continue;
      }

      if (typeof raw === "string") {
        lastPreview = raw.slice(0, 500);
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("[company-lookup] marocfacture attempt:", attempt.label);
        if (lastPreview) console.log("[company-lookup] html preview:", lastPreview);
      }

      const parsedResult = parseMarocFactureResult(raw, normalizedQuery);
      if (parsedResult.status === "found" || parsedResult.status === "not_found" || parsedResult.status === "blocked") {
        return parsedResult;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn("[company-lookup] marocfacture attempt failed:", attempt.label, message);
    }
  }

  if (process.env.NODE_ENV !== "production" && lastPreview) {
    console.log("[company-lookup] no parsed result. Last HTML preview:", lastPreview);
  }

  return {
    status: "unavailable",
    message: "La recherche automatique n’a pas pu aboutir. Vous pouvez continuer manuellement avec les informations dont vous disposez.",
  };
}
