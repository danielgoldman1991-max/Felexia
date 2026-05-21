export type VatFrequency = "monthly" | "quarterly";

export type TaxExportStatus =
  | "draft"
  | "preflight_failed"
  | "ready_to_generate"
  | "generated"
  | "generated_with_warnings"
  | "downloaded"
  | "superseded"
  | "archived";

export type DgiVatSeverity = "blocking" | "warning" | "info";

export type DgiVatValidationIssueSource =
  | "organization"
  | "customer"
  | "supplier"
  | "third_party"
  | "customer_invoice"
  | "supplier_invoice"
  | "sales_document"
  | "purchase_document"
  | "customer_payment"
  | "supplier_payment"
  | "accounting_entry"
  | "tax_rate"
  | "treasury_transaction"
  | "payment"
  | "sales"
  | "purchase"
  | "accounting"
  | "unknown";

export type DgiVatValidationIssue = {
  code: string;
  severity: DgiVatSeverity;
  message: string;
  source?: DgiVatValidationIssueSource;
  sourceId?: string | null;
  sourceTable?: string | null;
  documentNumber?: string | null;
  documentType?: string | null;
  thirdPartyId?: string | null;
  thirdPartyName?: string | null;
  correctionUrl?: string | null;
  correctionLabel?: string | null;
  suggestedFix?: string | null;
};

export type DgiVatTaxBreakdown = {
  taxRate: number;
  baseHtMad: number;
  vatAmountMad: number;
  totalTtcMad?: number;
};

export type DgiVatSalesDocument = {
  id: string;
  documentType: "INVOICE" | "CREDIT_NOTE";
  invoiceNumber: string;
  originalInvoiceNumber?: string | null;
  issueDate: string;
  customerId: string | null;
  customerName: string | null;
  customerIf: string | null;
  customerIce: string | null;
  currencySource: string;
  exchangeRateToMad?: number | null;
  taxBreakdown: DgiVatTaxBreakdown[];
  totalTtcMad: number;
  status?: string | null;
  accountingStatus?: "posted" | "not_posted";
};

export type DgiVatPurchaseDocument = {
  id: string;
  documentType: "INVOICE" | "CREDIT_NOTE";
  referenceNumber: string;
  originalReferenceNumber?: string | null;
  issueDate: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierIf: string | null;
  supplierIce: string | null;
  description: string | null;
  currencySource: string;
  exchangeRateToMad?: number | null;
  paymentMode: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  taxBreakdown: Array<{
    taxRate: number;
    baseHtMad: number;
    vatOnInvoiceMad: number;
    deductibleVatMad: number;
  }>;
  totalTtcMad: number;
  paidAmountMad: number;
  importFlag: boolean;
  immobilizationFlag: boolean;
  status?: string | null;
  accountingStatus?: "posted" | "not_posted";
};

export type DgiVatDeclarationLine = {
  code: string;
  label: string;
  amountMad: number;
};

export type DgiVatSummary = {
  priorCreditMad: number;
  totalTurnoverMad: number;
  taxableTurnoverMad: number;
  collectedVatMad: number;
  deductibleVatMad: number;
  vatDueMad: number;
  creditCarryForwardMad: number;
  salesCount: number;
  purchaseCount: number;
  blockingErrorsCount: number;
  warningsCount: number;
};

export type DgiVatExportData = {
  batchId: string;
  generatedAt: string;
  schemaVersion: string;
  sourceSnapshotHash: string;

  organization: {
    id: string;
    name: string;
    legalName: string | null;
    ifNumber: string | null;
    ice: string | null;
    currency: string;
    address: string | null;
    city: string | null;
    countryCode: string;
  };

  period: {
    startDate: string;
    endDate: string;
    frequency: VatFrequency;
    regime: "encaissement" | "debit" | "mixed" | "unspecified";
  };

  declarationLines: DgiVatDeclarationLine[];
  salesDocuments: DgiVatSalesDocument[];
  purchaseDocuments: DgiVatPurchaseDocument[];
  summary: DgiVatSummary;
  validationIssues: DgiVatValidationIssue[];
};

export type DgiVatExportHistoryRow = {
  id: string;
  export_number: string | null;
  export_type: string;
  period_start: string;
  period_end: string;
  frequency: VatFrequency | null;
  status: string;
  schema_version: string | null;
  xml_path: string | null;
  csv_path: string | null;
  xlsx_path: string | null;
  manifest_path: string | null;
  validation_report_path: string | null;
  totals: Record<string, unknown> | null;
  warnings: unknown[] | null;
  validation_errors: unknown[] | null;
  download_count: number | null;
  downloaded_at: string | null;
  generated_at: string | null;
  created_at: string;
};
