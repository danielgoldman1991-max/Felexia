export type NumberingGroup = "sales" | "purchases" | "contacts" | "accounting" | "other";

export type NumberingCounter = {
  key: string;
  group: NumberingGroup;
  label: string;
  description?: string;
  prefix: string;
  periodLabel: string;
  resetPeriod: "monthly" | "yearly";
  nextNumber: number;
  minNextNumber: number;
  maxNextNumber: number;
  lastUsedNumber: string | null;
  lastUsedValue: number | null;
  nextExample: string;
  numberPattern: string;
  numberWidth: number;
  revision: string;
  editable?: boolean;
  issue?: string | null;
};

export type NumberingSettingsData = {
  counters: NumberingCounter[];
  canEdit: boolean;
  migrationReady: boolean;
  error?: string | null;
  selectedPeriod: string;
  periodLabel: string;
};

export type NumberingActionState = {
  success: boolean;
  error: string | null;
  message?: string;
  counter?: NumberingCounter;
};
