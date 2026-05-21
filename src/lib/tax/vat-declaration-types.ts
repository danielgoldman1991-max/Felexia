export type VatDeclarationStatus = "draft" | "under_review" | "validated" | "exported" | "archived";
export type VatDeclarationFrequency = "monthly" | "quarterly" | "annual_control";
export type VatDeclarationRegime = "encaissement" | "debit" | "mixed" | "unspecified";

export type VatDeclarationRecord = {
  id: string;
  organization_id: string;
  declaration_number: string;
  period_start: string;
  period_end: string;
  frequency: VatDeclarationFrequency;
  vat_regime: VatDeclarationRegime;
  status: VatDeclarationStatus;

  prior_credit: number;
  collected_vat: number;
  deductible_vat: number;
  vat_due: number;
  credit_to_carry_forward: number;

  taxable_turnover: number;
  total_sales_ttc: number;
  total_purchases_ht: number;
  total_purchases_ttc: number;

  customer_invoices_count: number;
  supplier_invoices_count: number;
  blocking_errors_count: number;
  warnings_count: number;

  validation_summary: Record<string, unknown>;
  totals_by_rate: Record<string, unknown>;
  notes: string | null;

  created_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  submitted_at: string | null;

  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type VatDeclarationActionResult = {
  success: boolean;
  error?: string;
  declarationId?: string;
};

export const VAT_DECLARATION_STATUS_LABELS: Record<VatDeclarationStatus, string> = {
  draft: "Brouillon",
  under_review: "En révision",
  validated: "Validée",
  exported: "Exportée",
  archived: "Archivée",
};

export const VAT_DECLARATION_FREQUENCY_LABELS: Record<VatDeclarationFrequency, string> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  annual_control: "Contrôle annuel",
};

export const VAT_DECLARATION_REGIME_LABELS: Record<VatDeclarationRegime, string> = {
  encaissement: "Encaissement",
  debit: "Débit",
  mixed: "Mixte",
  unspecified: "Non spécifié",
};
