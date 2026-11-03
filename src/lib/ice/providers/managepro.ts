/** Public company lookup form. Its anonymous session belongs to this lookup only. */
import { DomUtils, parseDocument } from "htmlparser2";
import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { normalizeCompanyName, normalizeIce, parseCompanyLookupInput } from "@/lib/ice/ice";

const LOOKUP_PAGE = "https://www.managepro.ma/companylookup";
const LOOKUP_ACTION = "https://www.managepro.ma/companylookupjson";
const MAX_HTML_BYTES = 512 * 1024;
const MAX_CANDIDATES = 10;
const USER_AGENT = "FelexiaCompanyLookup/1.0 (+https://felexia.pro/bot; contact@felexia.pro)";
type Element = ReturnType<typeof DomUtils.findAll>[number];

function hasClass(element: Element, name: string): boolean {
  return (element.attribs.class ?? "").split(/\s+/).includes(name);
}

function text(element: Element | null): string {
  if (!element) return "";
  // Script/style contents are never company data, even inside an upstream field.
  const safeText = (node: typeof element.children[number]): string => {
    if (node.type === "text") return node.data;
    if ("name" in node && ["script", "style"].includes(node.name)) return "";
    return "children" in node ? node.children.map(safeText).join("") : "";
  };
  return element.children.map(safeText).join("").replace(/\s+/g, " ").trim().slice(0, 1000);
}

function matchingName(value: string): string {
  return normalizeCompanyName(value).normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** No edit-distance guess: every word must match a complete word or a prefix
 * of at least three characters. A word can match anywhere in a legal name.
 * Prefix-only matches remain suggestions, even when there is only one.
 */
function nameMatchRank(name: string, requested: string): number | null {
  if (!requested) return null;
  if (name === requested) return 0;
  const requestedWords = requested.split(" ");
  const words = name.split(" ");
  const allComplete = requestedWords.every((word) => words.includes(word));
  const allMatch = requestedWords.every((word) => words.includes(word) ||
    (word.length >= 3 && words.some((value) => value.startsWith(word))));
  if (!allMatch) return null;
  if (allComplete) return name.startsWith(`${requested} `) ? 1 : 2;
  return name.startsWith(requested) ? 3 : 4;
}

function stableIdentityKey(company: CompanyLookupResult): string {
  return [matchingName(company.raisonSociale ?? ""), company.ice, company.raisonSociale,
    company.rc, company.villeRc, company.formeJuridique, company.activite].join("\0");
}

const unavailable = (): CompanyLookupResponse => ({
  status: "unavailable",
  message: "La recherche automatique est temporairement indisponible. Réessayez ou continuez manuellement.",
});

/** Only the published result cards are parsed; unrelated page text is ignored. */
export function parseManageProResults(html: string, query: string): CompanyLookupResponse {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) return { status: "invalid_input", message: parsed.error ?? "Recherche invalide." };
  const document = parseDocument(html);
  const cards = DomUtils.findAll((node) => node.name === "article" && hasClass(node, "cl-result"), document.children);
  if (!cards.length) {
    const noResult = DomUtils.findOne((node) => hasClass(node, "cl-msg-info") && node.attribs.role === "status", document.children);
    return text(noResult).includes("Aucune entreprise trouvée pour")
      ? { status: "not_found", message: "Aucun résultat confirmé pour cette recherche." }
      : unavailable();
  }

  const companies: CompanyLookupResult[] = [];
  for (const card of cards.slice(0, 100)) {
    const raisonSociale = normalizeCompanyName(text(DomUtils.findOne((node) => hasClass(node, "cl-result-title"), card.children)));
    const fields = new Map<string, Element>();
    for (const field of DomUtils.findAll((node) => hasClass(node, "cl-field"), card.children)) {
      const label = text(DomUtils.findOne((node) => node.name === "dt", field.children));
      fields.set(label, field);
    }
    const fieldValue = (label: string) => {
      const field = fields.get(label);
      return field ? text(DomUtils.findOne((node) => hasClass(node, "cl-val"), field.children)) : "";
    };
    const ice = normalizeIce(fieldValue("ICE"));
    // A malformed card must not become a confirmed identity or enter the cache.
    if (!raisonSociale || !/^\d{15}$/.test(ice)) continue;
    const rcValue = fieldValue("RC");
    const [rc, ...city] = rcValue.split(/\s+[—–]\s+/);
    const villeRc = city.join(" — ") || null;
    const formeJuridique = text(DomUtils.findOne((node) => hasClass(node, "cl-badge") && !hasClass(node, "cl-badge-ok"), card.children)) || null;
    const activite = text(DomUtils.findOne((node) => hasClass(node, "cl-activite"), card.children)) || null;
    const result: CompanyLookupResult = {
      source: "managepro", query: parsed.normalizedValue, found: true,
      raisonSociale, ice, rc: rc || null, villeRc, ville: villeRc,
      formeJuridique, activite, adresse: null, identifiantFiscal: null,
      raw: { raisonSociale, ice, rc: rc || null, villeRc, formeJuridique, activite },
      confidence: "medium",
    };
    companies.push(result);
  }
  if (!companies.length) return unavailable();

  const requested = matchingName(parsed.normalizedValue);
  const ranked = companies.map((company) => ({
    company,
    // ICE lookup never uses a name approximation or first-result fallback.
    rank: parsed.type === "ice" ? (company.ice === parsed.normalizedValue ? 0 : null)
      : nameMatchRank(matchingName(company.raisonSociale ?? ""), requested),
    key: stableIdentityKey(company),
  })).filter((entry): entry is typeof entry & { rank: number } => entry.rank !== null)
    .sort((left, right) => left.rank - right.rank || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  const seen = new Set<string>();
  const unique = ranked.filter(({ company }) => {
    if (seen.has(company.ice!)) return false;
    seen.add(company.ice!);
    return true;
  });
  // Keep nearby name identities visible even when one legal name is exact.
  // Only one complete-word match can open the direct confirmation; a lone
  // prefix match still needs explicit selection as a nearby identity.
  const matches = unique.map((entry) => entry.company);
  if (!matches.length) return { status: "not_found", message: "Aucun résultat confirmé pour cette recherche." };
  const prefixOnlyMatch = parsed.type === "raison_sociale" && unique.some((entry) => entry.rank >= 3);
  if (matches.length > 1 || prefixOnlyMatch) return {
    status: "ambiguous",
    message: matches.length === 1
      ? "Une entreprise proche de votre recherche est proposée. Vérifiez son nom et ses identifiants avant de la choisir."
      : "Plusieurs entreprises correspondent à votre recherche. Sélectionnez celle qui vous concerne.",
    candidates: matches.slice(0, MAX_CANDIDATES),
    // This count concerns parsed source cards, not the entire company registry.
    candidateCount: matches.length,
    candidatesTruncated: matches.length > MAX_CANDIDATES,
  };
  return { status: "found", message: "Entreprise trouvée. Vérifiez ses informations avant de continuer.", result: matches[0] };
}

async function readHtml(response: Response): Promise<string> {
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) throw new Error("LOOKUP_CONTENT_TYPE");
  if (Number(response.headers.get("content-length")) > MAX_HTML_BYTES) throw new Error("LOOKUP_BODY_SIZE");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("LOOKUP_EMPTY_BODY");
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML_BYTES) throw new Error("LOOKUP_BODY_SIZE");
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function lookupCompanyOnManagePro(query: string): Promise<CompanyLookupResponse> {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) return { status: "invalid_input", message: parsed.error ?? "Recherche invalide." };
  // Do not silently truncate the source form's published 100-character limit.
  if (parsed.normalizedValue.length > 100) return { status: "invalid_input", message: "Utilisez l’ICE ou une raison sociale de 100 caractères maximum." };
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 15_000);
  const options = { signal: controller.signal, cache: "no-store" as const, redirect: "error" as const };
  try {
    const page = await fetch(LOOKUP_PAGE, { ...options, headers: { "user-agent": USER_AGENT, accept: "text/html" } });
    if (!page.ok) return unavailable();
    const document = parseDocument(await readHtml(page));
    const form = DomUtils.findOne((node) => node.name === "form" && node.attribs.method?.toLowerCase() === "post" &&
      new URL(node.attribs.action ?? "", LOOKUP_PAGE).href === LOOKUP_ACTION, document.children);
    if (!form) return unavailable();
    const token = DomUtils.findOne((node) => node.name === "input" && node.attribs.name === "_token", form.children)?.attribs.value;
    if (!token || token.length > 512 || /[\r\n]/.test(token)) return unavailable();
    // Only cookies issued for this new anonymous source session are forwarded.
    // No incoming Felexia cookie/header/credential is accepted by this provider.
    const cookies = page.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0])
      .filter((cookie) => /^[!#$%&'*+.^_`|~\w-]+=[^;\r\n]*$/.test(cookie)).join("; ");
    if (!cookies) return unavailable();
    const response = await fetch(LOOKUP_ACTION, {
      ...options, method: "POST",
      headers: { "user-agent": USER_AGENT, accept: "text/html", "content-type": "application/x-www-form-urlencoded", origin: "https://www.managepro.ma", referer: LOOKUP_PAGE, cookie: cookies },
      body: new URLSearchParams({ _token: token, thevalue: parsed.normalizedValue }),
    });
    if (!response.ok) return unavailable();
    return parseManageProResults(await readHtml(response), parsed.normalizedValue);
  } catch {
    // Neither a timeout, expired source session nor changed markup means not_found.
    console.warn("[company-lookup] public source request unavailable");
    return unavailable();
  } finally {
    clearTimeout(deadline);
  }
}
