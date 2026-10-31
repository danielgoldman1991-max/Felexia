/** Decimal values cross every boundary as strings. Runtime validation is strict. */
export type DecimalString = string;
export type EInvoiceSourceType = "customer_invoice" | "customer_credit_note";
export type EInvoiceDirection = "outbound" | "inbound";
export type EInvoiceBuyerType = "business" | "consumer" | "export";
export type EInvoiceTaxCategory = "S" | "Z" | "E" | "O";
export type EInvoiceIssue = { code: string; path: string; severity: "error" | "warning"; message: string; source: "technical" | "arithmetic" | "source_integrity" | "felexia_policy" };
export type EInvoiceParty = { name: string; address: string; city?: string | null; postalCode?: string | null; countryCode: string; ice?: string | null; ifNumber?: string | null; rc?: string | null };
export type EInvoiceLineMetadata = { unitCode?: string; taxCategory?: EInvoiceTaxCategory; exemptionReason?: string | null };
export type EInvoiceSourceTotals = { subtotalHt: DecimalString; discountTotal: DecimalString; taxTotal: DecimalString; totalTtc: DecimalString };
export type EInvoiceLineInput = {
  id: string; description: string; quantity: DecimalString; unitPriceHt: DecimalString;
  discountRate: DecimalString; taxRate: DecimalString;
  sourceAmounts?: { subtotalHt: DecimalString; discountAmount: DecimalString; taxAmount: DecimalString; totalTtc: DecimalString };
};
export type EInvoiceSnapshotInput = {
  organizationId: string; sourceType: EInvoiceSourceType; sourceId: string;
  direction?: EInvoiceDirection; number: string; issueDate: string; dueDate?: string | null;
  currency: string; seller: EInvoiceParty; buyer: EInvoiceParty; lines: EInvoiceLineInput[];
  sourceTotals: EInvoiceSourceTotals; originalInvoiceReference?: string | null; reason?: string | null;
  notes?: string | null; paymentTerms?: string | null;
};
export type EInvoicePreparationOptions = { buyerType: EInvoiceBuyerType; requireSellerRc?: boolean; lineMetadata?: Record<string, EInvoiceLineMetadata> };
export type EInvoiceNormalizedLine = EInvoiceLineInput & {
  unitCode: string; taxCategory: EInvoiceTaxCategory; exemptionReason: string | null;
  grossHt: DecimalString; discountAmount: DecimalString; subtotalHt: DecimalString; taxAmount: DecimalString; totalTtc: DecimalString;
};
export type EInvoiceTaxSubtotal = { category: EInvoiceTaxCategory; rate: DecimalString; exemptionReason: string | null; taxableAmount: DecimalString; taxAmount: DecimalString };
export type EInvoiceNormalizedSnapshot = Omit<EInvoiceSnapshotInput, "lines" | "direction"> & {
  schemaVersion: "felexia-einvoice-v1"; calculationPolicy: "felexia-postgres-v1";
  direction: "outbound"; buyerType: EInvoiceBuyerType; lines: EInvoiceNormalizedLine[];
  totals: EInvoiceSourceTotals & { lineExtensionAmount: DecimalString; taxExclusiveAmount: DecimalString; taxInclusiveAmount: DecimalString; allowanceTotalAmount: "0.00"; prepaidAmount: "0.00"; payableAmount: DecimalString };
  taxSubtotals: EInvoiceTaxSubtotal[];
};
export type EInvoiceValidationResult = { valid: boolean; issues: EInvoiceIssue[]; snapshot: EInvoiceNormalizedSnapshot | null };
export type EInvoiceXmlValidation = { valid: boolean; schema: "UBL-Invoice-2.1" | "UBL-CreditNote-2.1"; errors: string[]; schemaManifestSha256: string; engine: "libxml2-wasm-0.7.2"; schema_sha256: string };
export type EInvoicePreparedArtifact = {
  snapshot: EInvoiceNormalizedSnapshot; xml: string; canonicalXml: string;
  snapshotSha256: string; xmlSha256: string; canonicalSha256: string;
  canonicalizationAlgorithm: "http://www.w3.org/2006/12/xml-c14n11";
  validation: EInvoiceXmlValidation; issues: EInvoiceIssue[];
  officialConformityClaim: false; signed: false;
};
export type EInvoiceConnectorMode = "disabled" | "simulation" | "official";
export type EInvoiceSimulationOutcome = "accepted" | "rejected" | "timeout" | "temporary_failure" | "unknown";
export type EInvoiceConnectorReceipt = { simulation: true; authority: "FELEXIA_INTERNAL_SIMULATION"; reference: string; status: "accepted" | "rejected" | "pending" | "unknown"; documentHash: string; acknowledgement: string; attempts: number };
/** Future provider boundary: references only, never a private-key input/storage. */
export interface EInvoiceSignatureProvider {
  readonly available: boolean;
  sign(request: { canonicalXml: string; canonicalSha256: string; certificateReference: string; providerReference: string }): Promise<{ signedXml: string; certificateReference: string; timestampReference?: string; qualification: "not_asserted" }>;
  verify(request: { signedXml: string; certificateReference: string }): Promise<{ valid: boolean; trustStatus: "unverified" | "verified"; qualification: "not_asserted" }>;
}
