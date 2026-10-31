import { createHash } from "node:crypto";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { appendEinvoiceAudit, type EinvoiceEventRow } from "./repository";
import { EInvoiceError, uuid } from "./access";

export const OFFICIAL_EINVOICE_SOURCES = [
  { id: "dgi", title: "DGI - Publications", url: "https://www.tax.gov.ma/", classification: "official" as const },
  { id: "cgi-2026", title: "Code général des impôts 2026", url: "https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf", classification: "official" as const },
  { id: "bulletin-officiel", title: "SGG - Bulletin officiel", url: "https://www.sgg.gov.ma/BulletinOfficiel.aspx", classification: "official" as const },
  { id: "dgssi", title: "DGSSI - Services de confiance", url: "https://www.dgssi.gov.ma/", classification: "official" as const },
  { id: "cndp", title: "CNDP - Formalités et transferts", url: "https://www.cndp.ma/notifier-un-traitement/", classification: "official" as const },
] as const;
type OfficialSource = typeof OFFICIAL_EINVOICE_SOURCES[number];
const HOSTS = new Set(["www.tax.gov.ma", "tax.gov.ma", "www.finances.gov.ma", "finances.gov.ma", "www.sgg.gov.ma", "sgg.gov.ma", "www.dgssi.gov.ma", "dgssi.gov.ma", "www.cndp.ma", "cndp.ma"]);
const sha = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");

function requireOfficialUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || url.username || url.password || !HOSTS.has(url.hostname.toLowerCase())) throw new Error("OFFICIAL_SOURCE_REDIRECT_DENIED");
  return url;
}

/** Public-source reads only; no invoice, customer data, cookie or credential is sent. */
export async function fetchOfficialSource(source: OfficialSource, fetcher: typeof fetch = fetch) {
  let url = requireOfficialUrl(source.url);
  const deadline = AbortSignal.timeout(8000);
  for (let redirects = 0; redirects <= 2; redirects++) {
    const response = await fetcher(url, { redirect: "manual", cache: "no-store", signal: deadline, headers: { "User-Agent": "Felexia-Regulatory-Watch/1.0", Accept: "text/html,application/pdf,text/plain" } });
    if (response.status >= 300 && response.status < 400) {
      if (!response.headers.get("location") || redirects === 2) throw new Error("OFFICIAL_SOURCE_REDIRECT_DENIED");
      url = requireOfficialUrl(new URL(response.headers.get("location")!, url).href);
      continue;
    }
    if (!response.ok || !response.body) return { available: false, status: response.status, fingerprint: null, bytes: 0 };
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > 8 * 1024 * 1024) throw new Error("OFFICIAL_SOURCE_SIZE_LIMIT");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.byteLength;
        if (bytes > 8 * 1024 * 1024) throw new Error("OFFICIAL_SOURCE_SIZE_LIMIT");
        chunks.push(result.value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const body = Buffer.concat(chunks);
    const pdf = response.headers.get("content-type")?.includes("application/pdf") || body.subarray(0, 5).toString() === "%PDF-";
    const normalized = pdf ? body : Buffer.from(body.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), "utf8");
    if (normalized.length < 80) throw new Error("OFFICIAL_SOURCE_EMPTY");
    return { available: true, status: response.status, fingerprint: sha(normalized), rawSha256: sha(body), bytes, normalization: pdf ? "raw-pdf-v1" : "visible-text-v1", lastModified: response.headers.get("last-modified")?.slice(0, 120) ?? null };
  }
  throw new Error("OFFICIAL_SOURCE_UNAVAILABLE");
}

function alertId(organizationId: string, key: string) {
  const hex = sha(`einvoice-alert-v1|${organizationId}|${key}`).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

/** Idempotent in-app alert. Does not dispatch emails or certify a publication. */
export async function createEinvoiceAlert(organizationId: string, key: string, title: string, message: string, alertsEnabled: boolean) {
  if (!alertsEnabled) return;
  const { error } = await createServiceClient().from("app_notifications").insert({ id: alertId(organizationId, key), organization_id: organizationId,
    type: "einvoice_attention", title, message, action_label: "Consulter le module", action_url: "/facturation/electronique", severity: "warning", metadata: { kind: "einvoice_monitor", official_conformity: false } });
  if (error && error.code !== "23505") throw new EInvoiceError("ALERT_UNAVAILABLE", "Le contrôle a été enregistré mais l’alerte n’a pas pu être publiée.", 503);
}

export async function checkOfficialEinvoiceSources(actor: string, organizationId: string, history: EinvoiceEventRow[], alertsEnabled: boolean) {
  const outcomes = [];
  for (const source of OFFICIAL_EINVOICE_SOURCES) {
    let observation: Record<string, unknown>;
    try { observation = await fetchOfficialSource(source); }
    catch { observation = { available: false, status: 0, fingerprint: null, bytes: 0, error_code: "SOURCE_UNAVAILABLE" }; }
    const previous = history.filter(item => item.event === "regulatory.observed" && item.metadata.source_id === source.id && item.metadata.available === true).sort((a, b) => b.sequence - a.sequence)[0];
    const changed = observation.available === true && Boolean(previous?.metadata.fingerprint) && previous.metadata.fingerprint !== observation.fingerprint;
    const eventId = await appendEinvoiceAudit(actor, organizationId, null, "regulatory.observed", observation.available === true ? "info" : "warning", {
      source_id: source.id, source_title: source.title, source_url: source.url, ...observation, changed, human_review_required: changed,
      // A changed homepage is a review signal, not an automatically inferred rule.
      legal_requirement_inferred: false, production_rules_changed: false,
    });
    if (changed) await createEinvoiceAlert(organizationId, eventId, "Publication officielle à examiner", "Une source officielle a changé. Un administrateur doit en vérifier le contenu et l’impact ; aucune règle n’a été modifiée automatiquement.", alertsEnabled);
    outcomes.push({ sourceId: source.id, available: observation.available === true, changed });
  }
  return outcomes;
}

export function regulatoryView(history: EinvoiceEventRow[]) {
  const ordered = [...history].sort((a, b) => b.sequence - a.sequence);
  return {
    sources: OFFICIAL_EINVOICE_SOURCES.map(source => ({ ...source, checkedAt: ordered.find(event => event.event === "regulatory.observed" && event.metadata.source_id === source.id)?.created_at ?? null })),
    changes: ordered.filter(event => event.event === "regulatory.observed" && event.metadata.changed === true).map(event => {
      const review = ordered.find(item => item.event === "regulatory.reviewed" && item.metadata.change_id === event.id);
      return { id: event.id, title: String(event.metadata.source_title), summary: "Le contenu accessible a changé. Sa portée réglementaire et son impact nécessitent une vérification humaine.", observedAt: event.created_at, sourceUrl: String(event.metadata.source_url),
        reviewStatus: review?.metadata.decision === "approved" ? "approved" as const : review?.metadata.decision === "rejected" ? "rejected" as const : "pending" as const };
    }),
  };
}

export function validateRegulatoryReview(form: FormData, history: EinvoiceEventRow[]) {
  const changeId = uuid(form.get("changeId"));
  const change = history.find(event => event.id === changeId && event.event === "regulatory.observed" && event.metadata.changed === true);
  if (!change) throw new EInvoiceError("CHANGE_NOT_FOUND", "Le changement à examiner n’a pas été trouvé.", 404);
  const decision = form.get("decision");
  if (decision !== "approved" && decision !== "rejected") throw new EInvoiceError("INVALID_REVIEW", "Précisez le résultat de votre vérification.");
  const notes = String(form.get("notes") || "").trim();
  if (notes.length < 10 || notes.length > 2000) throw new EInvoiceError("INVALID_REVIEW", "Documentez l’exigence, l’impact technique et l’action à prévoir (10 à 2 000 caractères).");
  return { change_id: changeId, decision, notes, requirement: "Revue humaine consignée dans les notes", production_rules_changed: false };
}
