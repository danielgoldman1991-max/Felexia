import { normalizeOcrPayload, parseInvoiceText, type OcrSupplierInvoice } from "@/lib/purchases/supplier-invoice-ocr";

export function ocrIsConfigured() {
  return process.env.OCR_PROVIDER?.trim().toLowerCase() === "mistral" && Boolean(process.env.MISTRAL_API_KEY?.trim());
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplierName: { type: "string" },
    ice: { type: "string" },
    ifNumber: { type: "string" },
    rc: { type: "string" },
    address: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    invoiceNumber: { type: "string" },
    invoiceDate: { type: "string" },
    dueDate: { type: "string" },
    currency: { type: "string" },
    totalHt: { type: "number" },
    totalVat: { type: "number" },
    totalTtc: { type: "number" },
    vatByRate: { type: "array", items: { type: "object", additionalProperties: false, properties: { rate: { type: "number" }, amount: { type: "number" } }, required: ["rate", "amount"] } },
    lines: { type: "array", items: { type: "object", additionalProperties: false, properties: { description: { type: "string" }, quantity: { type: "number" }, unitPriceHt: { type: "number" }, vatRate: { type: "number" } }, required: ["description", "quantity", "unitPriceHt", "vatRate"] } },
  },
  required: ["supplierName", "ice", "ifNumber", "rc", "address", "phone", "email", "invoiceNumber", "invoiceDate", "dueDate", "currency", "totalHt", "totalVat", "totalTtc", "vatByRate", "lines"],
};

export function mistralDocumentBody(mime: string, base64: string) {
  const url = `data:${mime};base64,${base64}`;
  const document = mime === "application/pdf"
    ? { type: "document_url", document_url: url }
    : { type: "image_url", image_url: url };
  return {
    model: process.env.OCR_MODEL?.trim() || "mistral-ocr-latest",
    document,
    document_annotation_prompt: "Extrais la facture fournisseur marocaine : fournisseur, ICE, IF, RC, adresse, téléphone, e-mail, numéro, dates, lignes et totaux. Montants HT en nombres, taux de TVA parmi 20, 14, 10 et 7, dates AAAA-MM-JJ, ICE sans espace. N’invente pas une valeur absente : laisse une chaîne vide ou 0.",
    document_annotation_format: { type: "json_schema", json_schema: { name: "facture_fournisseur_maroc", strict: true, schema: SCHEMA } },
  };
}

export function invoiceFromMistralResponse(payload: unknown): OcrSupplierInvoice {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const annotation = record.document_annotation;
  if (typeof annotation === "string" && annotation.trim()) {
    try { return normalizeOcrPayload(JSON.parse(annotation)); } catch { /* Le markdown reste la source de repli. */ }
  }
  if (annotation && typeof annotation === "object") return normalizeOcrPayload(annotation);
  const pages = Array.isArray(record.pages) ? record.pages : [];
  const markdown = pages.map((page) => {
    const row = page && typeof page === "object" ? page as Record<string, unknown> : {};
    return typeof row.markdown === "string" ? row.markdown : "";
  }).join("\n");
  return parseInvoiceText(markdown);
}

export async function extractWithMistral(bytes: Buffer, mime: string, fetchImpl: typeof fetch = fetch): Promise<OcrSupplierInvoice> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) throw new Error("OCR non configuré.");
  const response = await fetchImpl("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(mistralDocumentBody(mime, bytes.toString("base64"))),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error("L’analyse du document a échoué. Aucune facture n’a été créée.");
  return invoiceFromMistralResponse(await response.json());
}
