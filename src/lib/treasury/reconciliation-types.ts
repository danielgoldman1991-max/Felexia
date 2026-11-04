import type { ReconciliationSettings } from "@/lib/treasury/match-engine";

export type ExpertLineView = {
  lineId: string;
  date: string;
  label: string;
  reference: string | null;
  amount: number;
  direction: "in" | "out";
  score: number;
  band: "auto" | "suggestion" | "todo";
  reason: string;
  summary: string;
};

export type ExpertReconciliationView = {
  pending: boolean;
  accountId: string;
  accountName: string;
  balances: { book: number | null; statement: number | null; gap: number | null };
  counts: { auto: number; suggestion: number; todo: number };
  lines: ExpertLineView[];
  events: { id: string; action: string; reason: string | null; score: number | null; createdAt: string }[];
  settings: ReconciliationSettings;
};
