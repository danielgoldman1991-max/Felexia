/** Public company lookup form. Its anonymous session belongs to this lookup only. */
import { DomUtils, parseDocument } from "htmlparser2";
import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { normalizeCompanyName, normalizeIce, parseCompanyLookupInput } from "@/lib/ice/ice";

const LOOKUP_PAGE = "https://www.managepro.ma/companylookup";
const LOOKUP_ACTION = "https://www.managepro.ma/companylookupjson";
const MAX_HTML_BYTES = 512 * 1024;
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
    if (!companies.some((company) => company.ice === ice)) companies.push(result);
  }
  if (!companies.length) return unavailable();

  let matches: CompanyLookupResult[];
  if (parsed.type === "ice") {
    // Never fall back to the first result when the requested ICE is absent.
    matches = companies.filter((company) => company.ice === parsed.normalizedValue);
  } else {
    const requested = matchingName(parsed.normalizedValue);
    const exact = companies.filter((company) => matchingName(company.raisonSociale ?? "") === requested);
    matches = exact.length ? exact : companies.filter((company) => {
      const words = matchingName(company.raisonSociale ?? "").split(" ");
      return requested.split(" ").every((word) => words.includes(word));
    });
  }
  if (!matches.length) return { status: "not_found", message: "Aucun résultat confirmé pour cette recherche." };
  if (matches.length > 1) return {
    status: "ambiguous",
    message: "Plusieurs entreprises correspondent à ce nom. Précisez la raison sociale ou utilisez l’ICE à quinze chiffres.",
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
