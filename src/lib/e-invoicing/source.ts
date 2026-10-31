import type { SupabaseClient } from "@supabase/supabase-js";
import type { EInvoiceSnapshotInput, EInvoiceParty, EInvoicePreparationOptions, EInvoiceLineMetadata } from "./types";
import { EInvoiceError, sourceKind, uuid } from "./access";

export type RawEinvoiceCapture = {
  organization_id: string; source_kind: "invoice" | "credit_note"; source_id: string;
  source_status: string; eligible: boolean; source_fingerprint: string;
  configuration: Record<string, unknown>; configuration_fingerprint: string;
  facts: { seller: Record<string, unknown>; buyer: Record<string, unknown>; header: Record<string, unknown>; lines: Record<string, unknown>[] };
};

export async function captureEinvoiceSource(client: SupabaseClient, kind: "invoice" | "credit_note", id: string, organizationId: string): Promise<RawEinvoiceCapture> {
  const { data, error } = await client.rpc("einvoice_capture_source", { p_source_kind: sourceKind(kind), p_source_id: uuid(id) });
  if (error || !data) throw new EInvoiceError("SOURCE_UNAVAILABLE", "Cette pièce n’est pas accessible ou sa préparation n’est pas encore disponible.", 404);
  const capture = data as RawEinvoiceCapture;
  if (capture.organization_id !== organizationId || capture.source_id !== id || capture.source_kind !== kind || !/^[a-f0-9]{64}$/.test(capture.source_fingerprint)) throw new EInvoiceError("SOURCE_INTEGRITY", "La référence de la pièce ne correspond pas à votre entreprise.", 403);
  return capture;
}

function str(value: unknown): string { return typeof value === "string" ? value : ""; }
function decimal(value: unknown): string {
  // PostgreSQL capture casts numerics to TEXT: never pass through IEEE floats.
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) throw new EInvoiceError("SOURCE_DECIMAL", "Une valeur décimale de la source ne peut pas être vérifiée exactement.");
  return value;
}
function country(value: unknown) {
  const text = str(value).trim();
  if (["maroc", "morocco", "المغرب", "ma"].includes(text.toLowerCase())) return "MA";
  return /^[A-Za-z]{2}$/.test(text) ? text.toUpperCase() : text;
}
function party(row: Record<string, unknown>): EInvoiceParty {
  return { name: str(row.name), address: str(row.address), city: str(row.city) || null, postalCode: str(row.postal_code) || null,
    countryCode: country(row.country_code ?? row.country), ice: str(row.ice) || null, ifNumber: str(row.if_number) || null, rc: str(row.rc) || null };
}

export function mapEinvoiceCapture(capture: RawEinvoiceCapture): EInvoiceSnapshotInput {
  const h = capture.facts.header;
  if (!Array.isArray(capture.facts.lines) || capture.facts.lines.length > 500) throw new EInvoiceError("SOURCE_LIMIT", "La pièce dépasse la limite de 500 lignes de cette version.");
  return {
    organizationId: capture.organization_id, sourceType: capture.source_kind === "invoice" ? "customer_invoice" : "customer_credit_note", sourceId: capture.source_id,
    direction: "outbound", number: str(h.number), issueDate: str(h.date), dueDate: str(h.due_date) || null, currency: str(h.currency),
    seller: party(capture.facts.seller), buyer: party(capture.facts.buyer),
    sourceTotals: { subtotalHt: decimal(h.subtotal_ht), discountTotal: decimal(h.discount_total), taxTotal: decimal(h.tax_total), totalTtc: decimal(h.total_ttc) },
    originalInvoiceReference: str(h.original_invoice_number) || null, reason: str(h.reason) || null, notes: str(h.notes) || null, paymentTerms: str(h.payment_terms) || str(h.payment_method) || null,
    lines: capture.facts.lines.map(row => ({ id: uuid(row.id), description: [...new Set([str(row.product_name).trim(), str(row.description).trim()].filter(Boolean))].join(" — "), quantity: decimal(row.quantity), unitPriceHt: decimal(row.unit_price_ht), discountRate: decimal(row.discount_rate), taxRate: decimal(row.tax_rate),
      sourceAmounts: { subtotalHt: decimal(row.subtotal_ht), discountAmount: decimal(row.discount_amount), taxAmount: decimal(row.tax_amount), totalTtc: decimal(row.total_ttc) } })),
  };
}

export function parseEinvoiceOptions(form: FormData, input: EInvoiceSnapshotInput, configuration: Record<string, unknown> = {}): EInvoicePreparationOptions {
  const buyer = form.get("buyerType") ?? configuration.buyer_type ?? "business";
  if (buyer !== "business" && buyer !== "consumer" && buyer !== "export") throw new EInvoiceError("INVALID_BUYER_TYPE", "Précisez la catégorie du client.");
  const raw = form.get("lineMetadata");
  if (typeof raw !== "string" || raw.length > 200_000) throw new EInvoiceError("INVALID_LINE_METADATA", "Les précisions fiscales des lignes sont invalides.");
  let rows: unknown;
  try { rows = JSON.parse(raw); } catch { throw new EInvoiceError("INVALID_LINE_METADATA", "Les précisions fiscales n’ont pas pu être lues."); }
  if (!Array.isArray(rows) || rows.length !== input.lines.length) throw new EInvoiceError("INVALID_LINE_METADATA", "Vérifiez les précisions de chaque ligne.");
  const ids = new Set(input.lines.map(row => row.id));
  const metadata: Record<string, EInvoiceLineMetadata> = {};
  for (const value of rows) {
    if (!value || typeof value !== "object") throw new EInvoiceError("INVALID_LINE_METADATA", "Ligne fiscale invalide.");
    const row = value as Record<string, unknown>;
    const id = uuid(row.sourceLineId);
    if (!ids.has(id) || metadata[id]) throw new EInvoiceError("INVALID_LINE_METADATA", "La ligne fiscale ne correspond pas à cette pièce.");
    const category = row.taxCategory;
    if (category && !["S", "Z", "E", "O"].includes(String(category))) throw new EInvoiceError("INVALID_TAX_CATEGORY", "Catégorie de TVA inconnue.");
    if (typeof row.unitCode !== "string" || !/^[A-Z0-9]{1,3}$/.test(row.unitCode)) throw new EInvoiceError("INVALID_UNIT", "Vérifiez le code d’unité.");
    if (row.exemptionReason != null && (typeof row.exemptionReason !== "string" || row.exemptionReason.length > 1000)) throw new EInvoiceError("INVALID_TAX_REASON", "Le motif fiscal est invalide.");
    metadata[id] = { unitCode: row.unitCode, taxCategory: category ? category as EInvoiceLineMetadata["taxCategory"] : undefined, exemptionReason: str(row.exemptionReason) || null };
  }
  return { buyerType: buyer, requireSellerRc: configuration.require_seller_rc === true, lineMetadata: metadata };
}
