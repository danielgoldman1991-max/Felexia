/** Presentation only. Decimal strings and snapshots remain owned by the domain. */
export type EinvoiceLanguage = "fr" | "ar";
export type EinvoiceSourceKind = "invoice" | "credit_note";
export type EinvoiceBuyerType = "business" | "consumer" | "export";
export type EinvoiceTaxCategory = "S" | "Z" | "E" | "O";
export type EinvoiceMode = "disabled" | "simulation";

export interface EinvoiceAccess {
  preferredLanguage?: EinvoiceLanguage;
  activationState?: "active" | "activation_required" | "deployment_required" | "subscription_readonly" | "role_readonly";
  enabled: boolean;
  migrationReady: boolean;
  canWrite: boolean;
  canAdmin: boolean;
  unavailableReason?: string;
}

export interface EinvoiceDashboardFilters {
  query?: string;
  status?: string;
  sourceKind?: EinvoiceSourceKind;
  page?: number;
}

export interface EinvoiceListItem {
  sourceKind: EinvoiceSourceKind;
  sourceId: string;
  documentId: string | null;
  latestVersionId: string | null;
  number: string;
  issueDate: string;
  buyerName: string;
  currency: string;
  totalTtc: string;
  sourceStatus: string;
  status: string;
  mode: EinvoiceMode;
  simulationStatus?: string;
  issueCount: number;
}

export interface EinvoiceDashboardView extends EinvoiceAccess {
  summary: { total: number; prepared: number; attention: number; ready: number };
  rows: EinvoiceListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EinvoiceIssue {
  code: string;
  message: string;
  messageAr?: string;
  severity: "error" | "warning";
  field?: string;
}

export interface EinvoicePreparationLine {
  sourceLineId: string;
  description: string;
  quantity: string;
  unitCode: string | null;
  taxRate: string;
  taxCategory: EinvoiceTaxCategory | null;
  exemptionReason: string | null;
}

export interface EinvoiceVersionView {
  id: string;
  sequence: number;
  createdAt: string;
  status: string;
  xmlAvailable: boolean;
  pdfAvailable: boolean;
  snapshotHash: string;
  integrity: "verified" | "failed" | "unchecked";
}

export interface EinvoiceEventView {
  id: string;
  createdAt: string;
  label: string;
  labelAr?: string;
  detail?: string | null;
  detailAr?: string | null;
  mode: EinvoiceMode;
}

export interface EinvoiceDetailView extends EinvoiceAccess {
  source: EinvoiceListItem | null;
  buyerType: EinvoiceBuyerType | null;
  lines: EinvoicePreparationLine[];
  versions: EinvoiceVersionView[];
  issues: EinvoiceIssue[];
  events: EinvoiceEventView[];
  capabilities: {
    canPrepare: boolean;
    canValidate: boolean;
    canIssue: boolean;
    canMarkReady: boolean;
    canSimulate: boolean;
    canCheckIntegrity: boolean;
  };
}

export interface EinvoiceRegulatorySourceView {
  id: string;
  title: string;
  url: string;
  classification: "official" | "announced" | "unconfirmed";
  checkedAt: string | null;
}

export interface EinvoiceRegulatoryChangeView {
  id: string;
  title: string;
  summary: string;
  observedAt: string;
  sourceUrl: string;
  reviewStatus: "pending" | "approved" | "rejected";
}

export interface EinvoiceConfigurationView extends EinvoiceAccess {
  settings: {
    connectorMode: EinvoiceMode;
    preferredLanguage: EinvoiceLanguage;
    alertsEnabled: boolean;
    organizationEnabled?: boolean;
    rolloutEnabled?: boolean;
    requireSellerRc?: boolean;
    buyerType?: EinvoiceBuyerType;
    revision?: number;
    defaultUnitCode?: string | null;
  };
  issuerName: string;
  issuerIssues: EinvoiceIssue[];
  regulatorySources: EinvoiceRegulatorySourceView[];
  regulatoryChanges: EinvoiceRegulatoryChangeView[];
  lastBackupVerification: { verifiedAt: string; reference: string; notes: string | null } | null;
}

export interface EinvoiceJobView {
  id: string;
  sourceKind: EinvoiceSourceKind;
  sourceId: string;
  number: string;
  state: string;
  mode: EinvoiceMode;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
}

export interface EinvoiceSupervisionView extends EinvoiceAccess {
  diagnostics?: { generated: number; validated: number; issued?: number; xmlFailures: number; duplicateAttempts: number; latestPreparationMs: number | null; validatorAvailable: boolean; backupAttestedAt: string | null; sourceChecksFailed: number };
  summary: { pending: number; failed: number; blocked: number; integrityFailures: number; linkedAccountingEntries?: number; sourcesWithoutAccounting?: number; duplicateAccountingSources?: number };
  jobs: EinvoiceJobView[];
  events: EinvoiceEventView[];
  connectorMode: EinvoiceMode;
  lastProcessingAt: string | null;
}
