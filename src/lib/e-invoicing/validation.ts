import { calculateExactLine } from "./calculations";
import { decimalScaled, decimalText } from "./decimal";
import type { EInvoiceIssue, EInvoiceNormalizedLine, EInvoiceNormalizedSnapshot, EInvoiceParty, EInvoicePreparationOptions, EInvoiceSnapshotInput, EInvoiceSourceTotals, EInvoiceTaxSubtotal, EInvoiceValidationResult } from "./types";

const XML_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const dateValid = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateEInvoiceSnapshot(input: EInvoiceSnapshotInput, options: EInvoicePreparationOptions): EInvoiceValidationResult {
  const issues: EInvoiceIssue[] = [];
  const issue = (code: string, path: string, message: string, source: EInvoiceIssue["source"] = "felexia_policy", severity: EInvoiceIssue["severity"] = "error") => issues.push({ code, path, message, source, severity });
  if (!input || typeof input !== "object" || !options) return { valid: false, snapshot: null, issues: [{ code: "INPUT_REQUIRED", path: "", message: "Document et options requis.", severity: "error", source: "technical" }] };
  if (input.direction && input.direction !== "outbound") issue("INBOUND_NOT_SUPPORTED", "direction", "La réception fournisseur nécessite un adaptateur distinct.", "technical");
  if (!["customer_invoice", "customer_credit_note"].includes(input.sourceType)) issue("SOURCE_NOT_SUPPORTED", "sourceType", "Seules les factures et avoirs clients sont pris en charge.", "technical");
  if (!["business", "consumer", "export"].includes(options.buyerType)) issue("BUYER_TYPE_REQUIRED", "buyerType", "Précisez le type de client.");
  for (const key of ["organizationId", "sourceId", "number"] as const) if (!clean(input[key])) issue("FIELD_REQUIRED", key, "Ce champ est obligatoire.");
  if (!dateValid(input.issueDate)) issue("DATE_INVALID", "issueDate", "Date d'émission invalide.", "technical");
  if (input.dueDate && !dateValid(input.dueDate)) issue("DATE_INVALID", "dueDate", "Date d'échéance invalide.", "technical");
  if (!/^[A-Z]{3}$/.test(input.currency || "")) issue("CURRENCY_INVALID", "currency", "Code devise à trois lettres requis.", "technical");
  function party(value: EInvoiceParty, path: "seller" | "buyer"): EInvoiceParty {
    const result: EInvoiceParty = { name: clean(value?.name), address: clean(value?.address), countryCode: clean(value?.countryCode).toUpperCase(), city: clean(value?.city) || null, postalCode: clean(value?.postalCode) || null, ice: clean(value?.ice) || null, ifNumber: clean(value?.ifNumber) || null, rc: clean(value?.rc) || null };
    for (const key of ["name", "address"] as const) if (!result[key]) issue("PARTY_FIELD_REQUIRED", path + "." + key, "Nom et adresse de la partie requis.");
    if (!/^[A-Z]{2}$/.test(result.countryCode)) issue("COUNTRY_INVALID", path + ".countryCode", "Code pays à deux lettres requis.", "technical");
    const requireIce = path === "seller" || options.buyerType === "business" && result.countryCode === "MA";
    if ((requireIce || result.ice) && !/^\d{15}$/.test(result.ice || "")) issue("ICE_FORMAT", path + ".ice", "L'ICE doit comporter quinze chiffres.");
    if (path === "seller" && !result.ifNumber) issue("SELLER_IF_REQUIRED", path + ".ifNumber", "Identifiant fiscal de l'émetteur requis.");
    if (path === "seller" && options.requireSellerRc && !result.rc) issue("SELLER_RC_REQUIRED", path + ".rc", "Le registre de commerce est requis par votre configuration.");
    if (path === "buyer" && options.buyerType === "export" && result.countryCode === "MA") issue("EXPORT_BUYER_COUNTRY", path + ".countryCode", "Un client export doit avoir un pays étranger explicite.");
    return result;
  }
  const seller = party(input.seller, "seller"), buyer = party(input.buyer, "buyer");
  const lines: EInvoiceNormalizedLine[] = [];
  const buckets = new Map<string, { row: EInvoiceTaxSubtotal; base: bigint; tax: bigint }>();
  const ids = new Set<string>();
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 500) issue("LINES_LIMIT", "lines", "Le document doit comporter de une à cinq cents lignes.", "technical");
  for (const [index, line] of (Array.isArray(input.lines) ? input.lines.slice(0, 500) : []).entries()) {
    const path = "lines." + index;
    if (!line || !clean(line.id) || ids.has(line.id)) { issue("LINE_ID_INVALID", path + ".id", "Chaque ligne doit avoir un identifiant distinct.", "technical"); continue; }
    ids.add(line.id);
    if (!clean(line.description)) issue("LINE_DESCRIPTION_REQUIRED", path + ".description", "Désignation requise.");
    const metadata = options.lineMetadata?.[line.id] || {};
    const unitCode = clean(metadata.unitCode) || "C62";
    if (!metadata.unitCode) issue("UNIT_DEFAULT_C62", path + ".unitCode", "Unité technique C62 utilisée par défaut : vérifiez qu'elle correspond à la pièce.", "felexia_policy", "warning");
    if (!/^[A-Z0-9]{1,8}$/.test(unitCode)) issue("UNIT_CODE_INVALID", path + ".unitCode", "Code unité technique invalide.", "technical");
    try {
      const amounts = calculateExactLine(line);
      const rate = decimalScaled(amounts.taxRate, 2);
      const category = metadata.taxCategory || (rate > BigInt("0") ? "S" : null);
      const reason = clean(metadata.exemptionReason) || null;
      if (!category || !["S", "Z", "E", "O"].includes(category)) issue("TAX_CATEGORY_REQUIRED", path + ".taxCategory", "Précisez la catégorie fiscale, notamment lorsque le taux est nul.");
      if (category === "S" && rate === BigInt("0") || category && category !== "S" && rate !== BigInt("0")) issue("TAX_CATEGORY_RATE_MISMATCH", path + ".taxRate", "La catégorie fiscale et le taux sont incohérents.");
      if (category && category !== "S" && !reason) issue("ZERO_TAX_REASON_REQUIRED", path + ".exemptionReason", "Un motif explicite est requis pour cette catégorie à taux nul.");
      if (line.sourceAmounts) for (const [key, actual] of Object.entries(line.sourceAmounts)) {
        if (!(key in amounts) || decimalScaled(actual, 2) !== decimalScaled(amounts[key as keyof typeof amounts], 2)) issue("SOURCE_LINE_AMOUNT_MISMATCH", path + ".sourceAmounts." + key, "Le montant de la pièce source ne correspond pas au calcul exact.", "source_integrity");
      }
      const normalized: EInvoiceNormalizedLine = { id: line.id, description: clean(line.description), ...amounts, unitCode, taxCategory: category || "S", exemptionReason: reason };
      lines.push(normalized);
      const key = JSON.stringify([category, amounts.taxRate, reason]);
      const bucket = buckets.get(key) || { row: { category: category || "S", rate: amounts.taxRate, exemptionReason: reason, taxableAmount: "0.00", taxAmount: "0.00" }, base: BigInt("0"), tax: BigInt("0") };
      bucket.base += decimalScaled(amounts.subtotalHt, 2); bucket.tax += decimalScaled(amounts.taxAmount, 2); buckets.set(key, bucket);
    } catch { issue("DECIMAL_LINE_INVALID", path, "Quantité, prix, remise ou TVA invalide : valeurs décimales textuelles requises.", "arithmetic"); }
  }
  const sums = { subtotalHt: BigInt("0"), discountTotal: BigInt("0"), taxTotal: BigInt("0"), totalTtc: BigInt("0") };
  for (const line of lines) { sums.subtotalHt += decimalScaled(line.subtotalHt, 2); sums.discountTotal += decimalScaled(line.discountAmount, 2); sums.taxTotal += decimalScaled(line.taxAmount, 2); sums.totalTtc += decimalScaled(line.totalTtc, 2); }
  const totals = Object.fromEntries(Object.entries(sums).map(([key, value]) => [key, decimalText(value, 2)])) as EInvoiceSourceTotals;
  for (const key of Object.keys(sums) as (keyof EInvoiceSourceTotals)[]) {
    try { if (decimalScaled(input.sourceTotals?.[key], 2) !== sums[key]) issue("SOURCE_TOTAL_MISMATCH", "sourceTotals." + key, "Le total source diffère du total exact. Aucune correction silencieuse ne sera effectuée.", "source_integrity"); }
    catch { issue("SOURCE_TOTAL_INVALID", "sourceTotals." + key, "Total source décimal textuel requis.", "source_integrity"); }
    if (sums[key] > BigInt("99999999999999")) issue("TOTAL_DATABASE_RANGE", "totals." + key, "Total hors précision du document source.", "arithmetic");
  }
  if (sums.totalTtc <= BigInt("0")) issue("TOTAL_POSITIVE_REQUIRED", "totals.totalTtc", "Le total TTC doit être positif.");
  const snapshot: EInvoiceNormalizedSnapshot = {
    schemaVersion: "felexia-einvoice-v1", calculationPolicy: "felexia-postgres-v1", direction: "outbound", buyerType: options.buyerType,
    organizationId: clean(input.organizationId), sourceType: input.sourceType, sourceId: clean(input.sourceId), number: clean(input.number), issueDate: input.issueDate,
    dueDate: input.dueDate || null, currency: input.currency, seller, buyer, lines,
    sourceTotals: { ...totals }, originalInvoiceReference: clean(input.originalInvoiceReference) || null, reason: clean(input.reason) || null, notes: clean(input.notes) || null, paymentTerms: clean(input.paymentTerms) || null,
    totals: { ...totals, lineExtensionAmount: totals.subtotalHt, taxExclusiveAmount: totals.subtotalHt, taxInclusiveAmount: totals.totalTtc, allowanceTotalAmount: "0.00", prepaidAmount: "0.00", payableAmount: totals.totalTtc },
    taxSubtotals: [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([, bucket]) => ({ ...bucket.row, taxableAmount: decimalText(bucket.base, 2), taxAmount: decimalText(bucket.tax, 2) })),
  };
  const text = JSON.stringify(snapshot);
  function containsInvalidText(value: unknown): boolean {
    if (typeof value === "string") return XML_TEXT.test(value);
    if (Array.isArray(value)) return value.some(containsInvalidText);
    return Boolean(value && typeof value === "object" && Object.values(value).some(containsInvalidText));
  }
  if (containsInvalidText(snapshot)) issue("XML_TEXT_INVALID", "", "Le document contient un caractère interdit en XML.", "technical");
  if (Buffer.byteLength(text, "utf8") > 1500000) issue("DOCUMENT_SIZE_LIMIT", "", "Document trop volumineux.", "technical");
  const valid = !issues.some(row => row.severity === "error");
  return { valid, issues, snapshot: valid ? snapshot : null };
}
