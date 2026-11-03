/** The source's published anonymous search form; no Felexia credentials. */
import { DomUtils, parseDocument } from "htmlparser2";
import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { normalizeCompanyName, parseCompanyLookupInput } from "@/lib/ice/ice";
import { selectCompanyLookupResults } from "@/lib/ice/company-lookup-matching";

const LOOKUP_ACTION = "https://ice.marocfacture.com/controller/controller.php";
const MAX_HTML_BYTES = 512 * 1024;
const USER_AGENT = "FelexiaCompanyLookup/1.0 (+https://felexia.pro/bot; contact@felexia.pro)";
type Element = ReturnType<typeof DomUtils.findAll>[number];

function hasClass(element: Element, name: string): boolean {
  return (element.attribs.class ?? "").split(/\s+/).includes(name);
}

function text(element: Element | null): string {
  if (!element) return "";
  const safeText = (node: typeof element.children[number]): string => {
    if (node.type === "text") return node.data;
    if ("name" in node && ["script", "style"].includes(node.name)) return "";
    return "children" in node ? node.children.map(safeText).join("") : "";
  };
  return element.children.map(safeText).join("").replace(/\s+/g, " ").trim().slice(0, 1000);
}

const unavailable = (): CompanyLookupResponse => ({
  status: "unavailable",
  message: "La recherche automatique est temporairement indisponible. Réessayez ou continuez manuellement.",
});

export function parseMarocFactureResults(html: string, query: string): CompanyLookupResponse {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) return { status: "invalid_input", message: parsed.error ?? "Recherche invalide." };
  const document = parseDocument(html);
  const cards = DomUtils.findAll((node) => node.name === "div" && hasClass(node, "conta"), document.children);
  // No published empty-result marker has been verified. Missing/malformed
  // cards cannot establish that a business does not exist.
  if (!cards.length) return unavailable();
  const companies: CompanyLookupResult[] = [];
  for (const card of cards.slice(0, 100)) {
    const field = (name: string) => DomUtils.findOne((node) => node.name === "p" && hasClass(node, name), card.children);
    const raisonSociale = normalizeCompanyName(text(field("par1")));
    const iceField = field("par2");
    const ice = iceField ? DomUtils.findOne((node) => node.name === "input" && hasClass(node, "inj"), iceField.children)?.attribs.value?.trim() : undefined;
    if (!raisonSociale || !ice || !/^\d{15}$/.test(ice)) continue;
    const rcField = DomUtils.findAll((node) => node.name === "p" && hasClass(node, "par4"), card.children)
      .map(text).find((value) => /^RC\s+/i.test(value));
    const rcMatch = rcField?.match(/^RC\s+(\S+)(?:\s+(.+))?$/i);
    const rc = rcMatch?.[1] ?? null;
    const villeRc = rcMatch?.[2] ?? null;
    const formeJuridique = text(field("par3")) || null;
    const activite = text(field("par5")).replace(/^Activit[ée]\s*:\s*/i, "") || null;
    companies.push({
      source: "marocfacture", query: parsed.normalizedValue, found: true,
      raisonSociale, ice, rc, villeRc, ville: villeRc, formeJuridique, activite,
      adresse: null, identifiantFiscal: null,
      raw: { raisonSociale, ice, rc, villeRc, formeJuridique, activite }, confidence: "medium",
    });
  }
  return companies.length ? selectCompanyLookupResults(companies, parsed.normalizedValue) : unavailable();
}

async function readHtml(response: Response): Promise<string> {
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) throw Error("LOOKUP_CONTENT_TYPE");
  if (Number(response.headers.get("content-length")) > MAX_HTML_BYTES) throw Error("LOOKUP_BODY_SIZE");
  const reader = response.body?.getReader();
  if (!reader) throw Error("LOOKUP_EMPTY_BODY");
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML_BYTES) throw Error("LOOKUP_BODY_SIZE");
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function lookupCompanyOnMarocFacture(query: string, remainingMs = 15_000): Promise<CompanyLookupResponse> {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) return { status: "invalid_input", message: parsed.error ?? "Recherche invalide." };
  if (parsed.normalizedValue.length > 100) return { status: "invalid_input", message: "Utilisez l’ICE ou une raison sociale de 100 caractères maximum." };
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return unavailable();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), Math.min(15_000, remainingMs));
  try {
    const response = await fetch(LOOKUP_ACTION, {
      method: "POST", signal: controller.signal, cache: "no-store", redirect: "error",
      headers: { "user-agent": USER_AGENT, accept: "text/html", "content-type": "application/x-www-form-urlencoded",
        origin: "https://ice.marocfacture.com", referer: "https://ice.marocfacture.com/" },
      body: new URLSearchParams({ [parsed.type === "ice" ? "name" : "namers"]: parsed.normalizedValue }),
    });
    return response.ok ? parseMarocFactureResults(await readHtml(response), parsed.normalizedValue) : unavailable();
  } catch {
    console.warn("[company-lookup] secondary public source request unavailable");
    return unavailable();
  } finally {
    clearTimeout(deadline);
  }
}
