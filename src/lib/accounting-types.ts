export type AccountingJournalType = "sales" | "purchases" | "bank" | "cash" | "od";

export type AccountingAccountType = "asset" | "liability" | "equity" | "revenue" | "expense" | "treasury" | "tax" | "third_party" | "other";

export type AccountingAuxiliaryType = "customer" | "supplier" | "employee" | "partner" | "other";

export type AccountingEntryStatus = "draft" | "posted" | "cancelled" | "reversed";

export type AccountingFiscalYearStatus = "open" | "closed";

export type AccountingPeriodStatus = "open" | "locked" | "closed";

export type AccountingReconciliationStatus = "none" | "partial" | "reconciled";

export type AccountingJournalRecord = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  type: AccountingJournalType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountingJournalWithStats = AccountingJournalRecord & {
  entries_count: number;
  total_debit: number;
  total_credit: number;
  last_entry_date: string | null;
};

export type AccountingJournalEntryFilters = {
  date_from?: string;
  date_to?: string;
  status?: string;
  source_type?: string;
  account_id?: string;
  third_party_id?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AccountingJournalEntryRow = AccountingEntryRecord & {
  source_number?: string | null;
};

export type AccountingJournalLineRow = AccountingEntryLineRecord & {
  entry_number: string;
  entry_date: string;
  entry_label: string;
  entry_status: AccountingEntryStatus;
};

export type AccountingJournalEntryListResult = {
  entries: AccountingJournalEntryRow[];
  lines: AccountingJournalLineRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    entries_count: number;
    total_debit: number;
    total_credit: number;
  };
};

export type AccountingJournalDetail = {
  journal: AccountingJournalRecord | null;
  stats: AccountingJournalWithStats | null;
};

export type AccountingAccountRecord = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  class_number: string;
  type: AccountingAccountType;
  parent_code: string | null;
  parent_account_id: string | null;
  is_movement_allowed: boolean;
  is_auxiliary_required: boolean;
  is_auxiliary: boolean;
  is_active: boolean;
  is_system: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AccountingAuxiliaryRecord = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  type: AccountingAuxiliaryType;
  general_account_code: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  ice: string | null;
  if_number: string | null;
  rc: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountingFiscalYearRecord = {
  id: string;
  organization_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: AccountingFiscalYearStatus;
  created_at: string;
  updated_at: string;
};

export type AccountingPeriodRecord = {
  id: string;
  organization_id: string;
  fiscal_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  created_at: string;
  updated_at: string;
};

export type AccountingEntryRecord = {
  id: string;
  organization_id: string;
  entry_number: string;
  journal_id: string;
  fiscal_year_id: string | null;
  period_id: string | null;
  entry_date: string;
  reference: string | null;
  label: string;
  source_module: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  status: AccountingEntryStatus;
  total_debit: number;
  total_credit: number;
  created_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  reversed_entry_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  journal_code?: string;
  journal_name?: string;
};

export type AccountingEntryLineRecord = {
  id: string;
  organization_id: string;
  entry_id: string;
  line_number: number;
  account_id: string;
  account_code: string;
  account_label: string;
  auxiliary_id: string | null;
  debit: number;
  credit: number;
  label: string | null;
  due_date: string | null;
  reconciliation_status: AccountingReconciliationStatus;
  created_at: string;
};

export type ChartOfAccountOption = {
  id: string;
  account_number: string;
  account_name: string;
  account_type?: string | null;
  is_active?: boolean;
};

export type AccountingEntryDetail = {
  entry: AccountingEntryRecord | null;
  lines: AccountingEntryLineRecord[];
};

export type AccountingSettingsRecord = {
  id: string;
  organization_id: string;
  sales_journal_code: string;
  purchases_journal_code: string;
  bank_journal_code: string;
  cash_journal_code: string;
  od_journal_code: string;
  default_customer_account_code: string;
  default_supplier_account_code: string;
  default_sales_account_code: string;
  default_purchase_account_code: string;
  default_sales_vat_account_code: string;
  default_purchase_vat_account_code: string;
  default_bank_account_code: string;
  default_cash_account_code: string;
  default_bank_fees_account_code: string;
  numbering_prefix: string;
  created_at: string;
  updated_at: string;
};

export type AccountingEntryLineFormValue = {
  id: string;
  account_id: string;
  account_code: string;
  account_label: string;
  debit: number;
  credit: number;
  label: string;
};

export type AccountingEntryFormValues = {
  journal_id: string;
  entry_date: string;
  reference: string;
  label: string;
  notes: string;
  lines: AccountingEntryLineFormValue[];
};

export type AccountingListFilters = {
  query?: string;
  status?: string;
  journal_id?: string;
  account_id?: string;
  page?: number;
  pageSize?: number;
};

export type AccountingActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export const JOURNAL_TYPE_LABELS: Record<string, string> = {
  sales: "Ventes",
  purchases: "Achats",
  bank: "Banque",
  cash: "Caisse",
  od: "Operations diverses",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Actif",
  liability: "Passif",
  equity: "Capitaux propres",
  revenue: "Produits",
  expense: "Charges",
  treasury: "Tresorerie",
  tax: "Taxes",
  third_party: "Tiers",
  other: "Autres",
};

export const ACCOUNT_CLASS_LABELS: Record<string, string> = {
  "1": "Capitaux propres",
  "2": "Immobilisations",
  "3": "Stocks",
  "4": "Tiers",
  "5": "Tresorerie",
  "6": "Charges",
  "7": "Produits",
};

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  posted: "Comptabilisee",
  cancelled: "Non disponible",
  reversed: "Contre-passee",
};

export const FISCAL_YEAR_STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  closed: "Clos",
};

export const PERIOD_STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  locked: "Verrouille",
  closed: "Clos",
};

export const AUXILIARY_TYPE_LABELS: Record<string, string> = {
  customer: "Client",
  supplier: "Fournisseur",
  employee: "Employe",
  partner: "Partenaire",
  other: "Autre",
};

export type ChartOfAccountFilters = {
  q?: string;
  account_class?: string;
  account_type?: string;
  is_auxiliary?: boolean;
  is_active?: string;
  parent_account_id?: string;
  include_archived?: boolean;
  page?: number;
  pageSize?: number;
};

export type ChartOfAccountUsageStats = {
  lines_count: number;
  total_debit: number;
  total_credit: number;
  balance: number;
  last_used_date: string | null;
};

export const ACCOUNT_CLASS_OPTIONS = [
  { value: "1", label: "Classe 1 - Comptes de financement permanent" },
  { value: "2", label: "Classe 2 - Comptes d'actif immobilise" },
  { value: "3", label: "Classe 3 - Comptes d'actif circulant (hors tresorerie)" },
  { value: "4", label: "Classe 4 - Comptes de passif circulant (hors tresorerie)" },
  { value: "5", label: "Classe 5 - Comptes de tresorerie" },
  { value: "6", label: "Classe 6 - Comptes de charges" },
  { value: "7", label: "Classe 7 - Comptes de produits" },
  { value: "8", label: "Classe 8 - Comptes de resultats" },
  { value: "9", label: "Classe 9 - Comptes analytiques / internes" },
];

export function getAccountClassFromNumber(accountNumber: string): string {
  return accountNumber?.charAt(0) ?? "";
}

export function getAccountClassLabel(classNumber: string): string {
  const found = ACCOUNT_CLASS_OPTIONS.find((c) => c.value === classNumber);
  return found ? found.label : `Classe ${classNumber}`;
}

export const ACCOUNT_TYPE_OPTIONS = [
  { value: "asset", label: "Actif" },
  { value: "liability", label: "Passif" },
  { value: "equity", label: "Capitaux propres" },
  { value: "revenue", label: "Produit" },
  { value: "expense", label: "Charge" },
  { value: "tax", label: "Taxe / TVA" },
  { value: "treasury", label: "Tresorerie" },
  { value: "third_party", label: "Tiers" },
  { value: "other", label: "Autre" },
];

export type VatPreparationSummary = {
  collectedVat: number | null;
  deductibleVat: number | null;
  estimatedVatBalance: number | null;
  nextPeriod: string | null;
};

export const ACCOUNT_CLASS_AUTO_TYPE: Record<string, string> = {
  "1": "equity",
  "2": "asset",
  "3": "third_party",
  "4": "liability",
  "5": "treasury",
  "6": "expense",
  "7": "revenue",
  "8": "other",
  "9": "other",
};
