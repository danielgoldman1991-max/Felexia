import { createHash } from "node:crypto";
import { decimalScaled, decimalText } from "./decimal";
import { validateEInvoiceSnapshot } from "./validation";
import { canonicalizeXml, C14N_ALGORITHM, validateUblXml } from "./xml-runtime";
import type { EInvoiceNormalizedLine, EInvoiceNormalizedSnapshot, EInvoiceParty, EInvoicePreparationOptions, EInvoicePreparedArtifact, EInvoiceSnapshotInput } from "./types";

const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const cbc = (name: string, value: string) => `<cbc:${name}>${xml(value)}</cbc:${name}>`;
const amount = (name: string, value: string, currency: string) => `<cbc:${name} currencyID="${xml(currency)}">${value}</cbc:${name}>`;
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function canonicalSnapshotJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalSnapshotJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => JSON.stringify(key) + ":" + canonicalSnapshotJson(child)).join(",") + "}";
  return JSON.stringify(value);
}

function party(value: EInvoiceParty, role: "Supplier" | "Customer") {
  return `<cac:Accounting${role}Party><cac:Party>`
    + (value.ice ? `<cac:PartyIdentification><cbc:ID schemeID="MA:ICE">${xml(value.ice)}</cbc:ID></cac:PartyIdentification>` : "")
    + `<cac:PartyName>${cbc("Name", value.name)}</cac:PartyName><cac:PostalAddress>${cbc("StreetName", value.address)}`
    + (value.city ? cbc("CityName", value.city) : "") + (value.postalCode ? cbc("PostalZone", value.postalCode) : "")
    + `<cac:Country>${cbc("IdentificationCode", value.countryCode)}</cac:Country></cac:PostalAddress>`
    + (value.ifNumber ? `<cac:PartyTaxScheme>${cbc("CompanyID", value.ifNumber)}<cac:TaxScheme>${cbc("ID", "VAT")}</cac:TaxScheme></cac:PartyTaxScheme>` : "")
    + `<cac:PartyLegalEntity>${cbc("RegistrationName", value.name)}${value.rc ? cbc("CompanyID", value.rc) : ""}</cac:PartyLegalEntity>`
    + `</cac:Party></cac:Accounting${role}Party>`;
}

function taxCategory(line: Pick<EInvoiceNormalizedLine, "taxCategory" | "taxRate" | "exemptionReason">, classified = false) {
  const tag = classified ? "ClassifiedTaxCategory" : "TaxCategory";
  return `<cac:${tag}>${cbc("ID", line.taxCategory)}${cbc("Percent", line.taxRate)}${line.exemptionReason ? cbc("TaxExemptionReason", line.exemptionReason) : ""}<cac:TaxScheme>${cbc("ID", "VAT")}</cac:TaxScheme></cac:${tag}>`;
}

export function generateUblXml(snapshot: EInvoiceNormalizedSnapshot): string {
  const credit = snapshot.sourceType === "customer_credit_note";
  const root = credit ? "CreditNote" : "Invoice";
  const currency = snapshot.currency;
  const lines = snapshot.lines.map((line, index) => {
    const name = credit ? "CreditNoteLine" : "InvoiceLine";
    const category = taxCategory(line, true);
    const allowance = decimalScaled(line.discountAmount, 2) > BigInt("0") ? `<cac:AllowanceCharge>${cbc("ChargeIndicator", "false")}${cbc("AllowanceChargeReason", "Remise de ligne")}${cbc("MultiplierFactorNumeric", decimalText(decimalScaled(line.discountRate, 2), 4))}${amount("Amount", line.discountAmount, currency)}${amount("BaseAmount", line.grossHt, currency)}</cac:AllowanceCharge>` : "";
    const tax = `<cac:TaxTotal>${amount("TaxAmount", line.taxAmount, currency)}</cac:TaxTotal>`;
    return `<cac:${name}>${cbc("ID", String(index + 1))}<cbc:${credit ? "CreditedQuantity" : "InvoicedQuantity"} unitCode="${xml(line.unitCode)}">${line.quantity}</cbc:${credit ? "CreditedQuantity" : "InvoicedQuantity"}>`
      + amount("LineExtensionAmount", line.subtotalHt, currency)
      + (credit ? tax + allowance : allowance + tax)
      + `<cac:Item>${cbc("Description", line.description)}${category}</cac:Item><cac:Price>${amount("PriceAmount", line.unitPriceHt, currency)}<cbc:BaseQuantity unitCode="${xml(line.unitCode)}">1</cbc:BaseQuantity></cac:Price></cac:${name}>`;
  }).join("");
  const taxes = snapshot.taxSubtotals.map(row => `<cac:TaxSubtotal>${amount("TaxableAmount", row.taxableAmount, currency)}${amount("TaxAmount", row.taxAmount, currency)}${taxCategory({ taxCategory: row.category, taxRate: row.rate, exemptionReason: row.exemptionReason })}</cac:TaxSubtotal>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`
    + cbc("UBLVersionID", "2.1") + cbc("CustomizationID", "urn:felexia:ubl:2.1:generic-preparatory:v1")
    + cbc("ID", snapshot.number) + cbc("IssueDate", snapshot.issueDate) + (!credit && snapshot.dueDate ? cbc("DueDate", snapshot.dueDate) : "")
    + cbc(credit ? "CreditNoteTypeCode" : "InvoiceTypeCode", credit ? "381" : "380")
    + (snapshot.reason ? cbc("Note", snapshot.reason) : "") + (snapshot.notes ? cbc("Note", snapshot.notes) : "") + cbc("DocumentCurrencyCode", currency)
    + (snapshot.originalInvoiceReference ? `<cac:BillingReference><cac:InvoiceDocumentReference>${cbc("ID", snapshot.originalInvoiceReference)}</cac:InvoiceDocumentReference></cac:BillingReference>` : "")
    + party(snapshot.seller, "Supplier") + party(snapshot.buyer, "Customer")
    + (snapshot.paymentTerms ? `<cac:PaymentTerms>${cbc("Note", snapshot.paymentTerms)}</cac:PaymentTerms>` : "")
    + `<cac:TaxTotal>${amount("TaxAmount", snapshot.totals.taxTotal, currency)}${taxes}</cac:TaxTotal>`
    + `<cac:LegalMonetaryTotal>${amount("LineExtensionAmount", snapshot.totals.lineExtensionAmount, currency)}${amount("TaxExclusiveAmount", snapshot.totals.taxExclusiveAmount, currency)}${amount("TaxInclusiveAmount", snapshot.totals.taxInclusiveAmount, currency)}${amount("AllowanceTotalAmount", "0.00", currency)}${amount("PrepaidAmount", "0.00", currency)}${amount("PayableAmount", snapshot.totals.payableAmount, currency)}</cac:LegalMonetaryTotal>${lines}</${root}>`;
}

export async function prepareEInvoice(input: EInvoiceSnapshotInput, options: EInvoicePreparationOptions): Promise<EInvoicePreparedArtifact> {
  const result = validateEInvoiceSnapshot(input, options);
  if (!result.valid || !result.snapshot) throw Object.assign(new Error("EINVOICE_VALIDATION_FAILED"), { issues: result.issues });
  const xml = generateUblXml(result.snapshot);
  const validation = await validateUblXml(xml, input.sourceType);
  if (!validation.valid) throw Object.assign(new Error("EINVOICE_XSD_VALIDATION_FAILED"), { validation });
  const canonicalXml = await canonicalizeXml(xml);
  return { snapshot: result.snapshot, xml, canonicalXml, snapshotSha256: digest(canonicalSnapshotJson(result.snapshot)), xmlSha256: digest(xml), canonicalSha256: digest(canonicalXml), canonicalizationAlgorithm: C14N_ALGORITHM, validation, issues: result.issues, officialConformityClaim: false, signed: false };
}
