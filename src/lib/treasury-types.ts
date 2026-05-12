export type TreasuryAccountType = "bank" | "cash" | "mobile_money" | "payment_gateway" | "credit_card" | "other";
export type TreasuryAccountStatus = "active" | "inactive" | "archived";

export type TreasuryAccountRecord = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  account_type: TreasuryAccountType;
  bank_name: string | null;
  agency_name: string | null;
  rib: string | null;
  iban: string | null;
  swift: string | null;
  account_number: string | null;
  currency: string;
  opening_balance: number;
  current_balance: number;
  opening_balance_date: string | null;
  is_default: boolean;
  status: TreasuryAccountStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TreasuryTransactionType =
  | "customer_payment"
  | "supplier_payment"
  | "manual_in"
  | "manual_out"
  | "bank_fee"
  | "transfer_in"
  | "transfer_out"
  | "opening_balance"
  | "adjustment"
  | "other";
export type TreasuryTransactionDirection = "in" | "out";
export type ReconciliationStatus = "unreconciled" | "partially_reconciled" | "reconciled" | "ignored";

export type TreasuryTransactionRecord = {
  id: string;
  organization_id: string;
  treasury_account_id: string;
  account_name?: string | null;
  transaction_type: TreasuryTransactionType;
  direction: TreasuryTransactionDirection;
  amount: number;
  currency: string;
  transaction_date: string;
  value_date: string | null;
  label: string;
  reference: string | null;
  description: string | null;
  third_party_id: string | null;
  third_party_name?: string | null;
  customer_payment_id: string | null;
  supplier_payment_id: string | null;
  customer_invoice_id: string | null;
  supplier_invoice_id: string | null;
  reconciliation_status: ReconciliationStatus;
  reconciled_at: string | null;
  created_at: string;
  archived_at: string | null;
};

export type BankStatementImportRecord = {
  id: string;
  organization_id: string;
  treasury_account_id: string;
  account_name?: string | null;
  import_code: string | null;
  file_name: string;
  file_type: string | null;
  file_hash: string | null;
  statement_fingerprint: string | null;
  period_start: string | null;
  period_end: string | null;
  imported_lines_count: number;
  matched_lines_count: number;
  unmatched_lines_count: number;
  status: string;
  imported_at: string;
  archived_at: string | null;
};

export type BankStatementLineRecord = {
  id: string;
  import_id: string;
  treasury_account_id: string;
  operation_date: string;
  value_date: string | null;
  label: string;
  reference: string | null;
  debit_amount: number;
  credit_amount: number;
  amount: number;
  direction: TreasuryTransactionDirection;
  balance_after: number | null;
  reconciliation_status: "unreconciled" | "suggested" | "reconciled" | "ignored";
  matched_transaction_id: string | null;
  match_score: number | null;
  match_reason: string | null;
  line_hash: string | null;
  line_fingerprint: string | null;
};

export type BankReconciliationRecord = {
  id: string;
  statement_line_id: string;
  transaction_id: string;
  amount: number;
  reconciliation_date: string;
  status: string;
  created_at: string;
};

export type TreasuryAccountFormValues = {
  name: string;
  account_type: TreasuryAccountType;
};

export type TreasuryTransactionFormValues = {
  treasury_account_id: string;
  transaction_type: TreasuryTransactionType;
  direction: TreasuryTransactionDirection;
  amount: number;
  label: string;
};

export type TreasuryCounters = {
  bankBalance: number;
  cashBalance: number;
  monthlyIn: number;
  monthlyOut: number;
  monthlyNet: number;
  unreconciledStatementLines: number;
  unreconciledTransactions: number;
};

export type ReconciliationSuggestion = {
  statementLine: BankStatementLineRecord;
  transaction: TreasuryTransactionRecord;
  score: number;
  label: "Suggestion forte" | "Suggestion moyenne" | "A verifier";
  reason: string;
};

export type BankStatementImportPreview = {
  lines: BankStatementLineRecord[];
};

export type TreasuryActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export const TREASURY_ACCOUNT_TYPE_LABELS: Record<TreasuryAccountType, string> = {
  bank: "Banque",
  cash: "Caisse",
  mobile_money: "Paiement mobile",
  payment_gateway: "Passerelle de paiement",
  credit_card: "Carte bancaire",
  other: "Autre",
};

export const TREASURY_TRANSACTION_TYPE_LABELS: Record<TreasuryTransactionType, string> = {
  customer_payment: "Paiement client",
  supplier_payment: "Paiement fournisseur",
  manual_in: "Entree manuelle",
  manual_out: "Sortie manuelle",
  bank_fee: "Frais bancaires",
  transfer_in: "Virement entrant",
  transfer_out: "Virement sortant",
  opening_balance: "Solde initial",
  adjustment: "Ajustement",
  other: "Autre",
};

export const RECONCILIATION_STATUS_LABELS: Record<string, string> = {
  unreconciled: "Non rapproche",
  partially_reconciled: "Partiellement rapproche",
  suggested: "Suggestion",
  reconciled: "Rapproche",
  ignored: "Ignore",
};

export type TreasuryConsultationFilters = {
  date_from?: string;
  date_to?: string;
  treasury_account_id?: string;
  account_type?: string;
  direction?: string;
  transaction_type?: string;
  reconciliation_status?: string;
  accounting_status?: string;
  third_party_id?: string;
  payment_method?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type TreasuryConsultationRow = {
  id: string;
  transaction_date: string;
  value_date: string | null;
  treasury_account_id: string;
  account_name: string | null;
  account_type: string | null;
  transaction_type: TreasuryTransactionType;
  direction: TreasuryTransactionDirection;
  amount: number;
  label: string;
  reference: string | null;
  third_party_id: string | null;
  third_party_name: string | null;
  third_party_type: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  customer_payment_id: string | null;
  supplier_payment_id: string | null;
  customer_invoice_id: string | null;
  supplier_invoice_id: string | null;
  customer_invoice_number: string | null;
  supplier_invoice_number: string | null;
  reconciliation_status: ReconciliationStatus;
  accounting_status: "posted" | "not_posted" | "not_applicable";
  accounting_entry_number: string | null;
  accounting_entry_id: string | null;
  currency: string;
  created_at: string;
};

export type TreasuryConsultationSummary = {
  total_entries: number;
  total_in: number;
  total_out: number;
  net_flow: number;
  posted_count: number;
  not_posted_count: number;
  reconciled_count: number;
  unreconciled_count: number;
};
