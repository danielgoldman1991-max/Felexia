import { requireActiveWorkspace } from "@/lib/auth";
import { isMissingSchema } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_RECONCILIATION_SETTINGS,
  matchStatementLines,
  reconciliationGap,
  type MatchCandidate,
  type MatchLearning,
  type MatchRule,
  type ProposedMatch,
  type StatementLineInput,
} from "@/lib/treasury/match-engine";
import { embeddedCustomerName } from "@/lib/sales/collection";
import type { ExpertReconciliationView } from "@/lib/treasury/reconciliation-types";

export type ExpertLineRecord = StatementLineInput & {
  importId: string | null;
  accountId: string;
};

export type ExpertState = {
  view: ExpertReconciliationView;
  proposals: ProposedMatch[];
  lines: ExpertLineRecord[];
};

export async function loadExpertReconciliation(accountId?: string) {
  const state = await buildExpertState(accountId);
  return state.view;
}

export async function buildExpertState(accountId?: string): Promise<ExpertState> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  const accounts = await supabase.from("treasury_accounts").select("id, name, current_balance, account_type").eq("organization_id", orgId).eq("status", "active").is("archived_at", null).order("name");
  const openAccounts = accounts.data ?? [];
  const selected = accountId || (openAccounts.find((item) => item.account_type === "bank")?.id as string | undefined) || (openAccounts[0]?.id as string | undefined) || "";
  const account = openAccounts.find((item) => item.id === selected);
  const empty = emptyView(selected, (account?.name as string | undefined) ?? "");
  if (!selected) return { view: empty, proposals: [], lines: [] };

  const [linesResult, txResult, customerResult, supplierResult, balanceResult, settingsResult, rulesResult, learningResult, eventsResult] = await Promise.all([
    supabase.from("bank_statement_lines").select("id, import_id, treasury_account_id, operation_date, value_date, label, reference, amount, direction").eq("organization_id", orgId).eq("treasury_account_id", selected).eq("reconciliation_status", "unreconciled").order("operation_date", { ascending: false }).limit(200),
    supabase.from("treasury_transactions").select("id, transaction_date, value_date, amount, direction, label, reference, third_party_id, customer_invoice_id").eq("organization_id", orgId).eq("treasury_account_id", selected).eq("reconciliation_status", "unreconciled").is("archived_at", null).limit(200),
    supabase.from("customer_invoices").select("id, invoice_number, customer_id, due_date, invoice_date, remaining_amount, customer:customer_id(name)").eq("organization_id", orgId).gt("remaining_amount", 0).not("status", "in", "(draft,cancelled)").is("archived_at", null).limit(400),
    supabase.from("supplier_invoices").select("id, invoice_number, supplier_id, due_date, invoice_date, remaining_amount").eq("organization_id", orgId).gt("remaining_amount", 0).in("status", ["validated", "partially_paid"]).is("archived_at", null).limit(400),
    supabase.from("bank_statement_lines").select("balance_after").eq("organization_id", orgId).eq("treasury_account_id", selected).not("balance_after", "is", null).order("operation_date", { ascending: false }).limit(1),
    supabase.from("bank_reconciliation_settings").select("auto_threshold, suggest_threshold, date_window_days, auto_enabled").eq("organization_id", orgId).maybeSingle(),
    supabase.from("bank_match_rules").select("id, label_contains, direction, category, third_party_id, account_code, auto_apply, active").eq("organization_id", orgId).eq("active", true).order("priority", { ascending: false }),
    supabase.from("bank_match_learnings").select("label_key, direction, third_party_id, confirmations").eq("organization_id", orgId).limit(200),
    supabase.from("bank_reconciliation_events").select("id, action, reason, score, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(12),
  ]);

  const pending = [settingsResult.error, rulesResult.error, learningResult.error].some((error) => isMissingSchema(error));
  const partyIds = [
    ...(txResult.data ?? []).map((row) => row.third_party_id),
    ...(customerResult.data ?? []).map((row) => row.customer_id),
    ...(supplierResult.data ?? []).map((row) => row.supplier_id),
  ].filter((id): id is string => Boolean(id));
  const parties = partyIds.length
    ? await supabase.from("third_parties").select("id, name, commercial_name").eq("organization_id", orgId).in("id", [...new Set(partyIds)])
    : { data: [] };
  const partyName = new Map((parties.data ?? []).map((party) => [party.id as string, (party.commercial_name as string | null) || (party.name as string)]));
  const invoiceNumbers = new Map((customerResult.data ?? []).map((row) => [row.id as string, row.invoice_number as string]));

  const lines: ExpertLineRecord[] = (linesResult.data ?? []).map((row) => ({
    id: row.id as string,
    importId: (row.import_id as string | null) ?? null,
    accountId: row.treasury_account_id as string,
    date: row.operation_date as string,
    valueDate: (row.value_date as string | null) ?? null,
    label: row.label as string,
    reference: (row.reference as string | null) ?? null,
    amount: Number(row.amount),
    direction: row.direction as "in" | "out",
  }));
  const candidates: MatchCandidate[] = [
    ...(txResult.data ?? []).map((row) => ({
      id: row.id as string,
      kind: "transaction" as const,
      date: (row.value_date as string | null) || (row.transaction_date as string),
      amount: Number(row.amount),
      direction: row.direction as "in" | "out",
      reference: (row.reference as string | null) ?? null,
      number: invoiceNumbers.get(row.customer_invoice_id as string) ?? null,
      partyName: partyName.get(row.third_party_id as string) ?? null,
      partyId: (row.third_party_id as string | null) ?? null,
      label: row.label as string,
    })),
    ...(customerResult.data ?? []).map((row) => ({
      id: row.id as string,
      kind: "customer_invoice" as const,
      date: (row.due_date as string | null) || (row.invoice_date as string),
      amount: Number(row.remaining_amount),
      direction: "in" as const,
      number: row.invoice_number as string,
      partyName: embeddedCustomerName(row.customer, partyName.get(row.customer_id as string) || "Client"),
      partyId: row.customer_id as string,
      label: row.invoice_number as string,
    })),
    ...(supplierResult.data ?? []).map((row) => ({
      id: row.id as string,
      kind: "supplier_invoice" as const,
      date: (row.due_date as string | null) || (row.invoice_date as string),
      amount: Number(row.remaining_amount),
      direction: "out" as const,
      number: row.invoice_number as string,
      partyName: partyName.get(row.supplier_id as string) ?? null,
      partyId: row.supplier_id as string,
      label: row.invoice_number as string,
    })),
  ];
  const settings = settingsResult.error || !settingsResult.data
    ? DEFAULT_RECONCILIATION_SETTINGS
    : {
      autoThreshold: Number(settingsResult.data.auto_threshold),
      suggestThreshold: Number(settingsResult.data.suggest_threshold),
      dateWindowDays: Number(settingsResult.data.date_window_days),
      autoEnabled: settingsResult.data.auto_enabled !== false,
    };
  const rules: MatchRule[] = rulesResult.error ? [] : (rulesResult.data ?? []).map((rule) => ({
    id: rule.id as string,
    labelContains: rule.label_contains as string,
    direction: (rule.direction as "in" | "out" | null) ?? null,
    category: rule.category as MatchRule["category"],
    thirdPartyId: (rule.third_party_id as string | null) ?? null,
    accountCode: (rule.account_code as string | null) ?? null,
    autoApply: rule.auto_apply === true,
    active: rule.active !== false,
  }));
  const learning: MatchLearning[] = learningResult.error ? [] : (learningResult.data ?? []).map((row) => ({
    labelKey: row.label_key as string,
    direction: row.direction as "in" | "out",
    thirdPartyId: (row.third_party_id as string | null) ?? null,
    confirmations: Number(row.confirmations ?? 1),
  }));
  const proposals = matchStatementLines({ lines, candidates, rules, learning, settings });
  const names = new Map(candidates.map((candidate) => [`${candidate.kind}:${candidate.id}`, candidate.number || candidate.partyName || candidate.label || "Pièce"]));
  const statementBalance = balanceResult.data?.[0]?.balance_after === null || balanceResult.data?.[0]?.balance_after === undefined
    ? null
    : Number(balanceResult.data[0].balance_after);
  const bookBalance = account ? Number(account.current_balance) : null;
  const view: ExpertReconciliationView = {
    pending,
    accountId: selected,
    accountName: (account?.name as string | undefined) ?? "",
    balances: { book: bookBalance, statement: statementBalance, gap: reconciliationGap(bookBalance, statementBalance) },
    counts: {
      auto: proposals.filter((item) => item.band === "auto").length,
      suggestion: proposals.filter((item) => item.band === "suggestion").length,
      todo: proposals.filter((item) => item.band === "todo").length,
    },
    lines: lines.map((line) => {
      const proposal = proposals.find((item) => item.lineId === line.id);
      return {
        lineId: line.id,
        date: line.date,
        label: line.label,
        reference: line.reference ?? null,
        amount: line.amount,
        direction: line.direction,
        score: proposal?.score ?? 0,
        band: proposal?.band ?? "todo",
        reason: proposal?.reason ?? "",
        summary: (proposal?.targets ?? []).map((target) => names.get(`${target.kind}:${target.id}`) || (target.kind === "fee" ? "Frais bancaire" : "Pièce")).join(" + "),
      };
    }),
    events: eventsResult.error ? [] : (eventsResult.data ?? []).map((event) => ({
      id: event.id as string,
      action: event.action as string,
      reason: (event.reason as string | null) ?? null,
      score: event.score === null ? null : Number(event.score),
      createdAt: event.created_at as string,
    })),
    settings,
  };
  return { view, proposals, lines };
}

function emptyView(accountId: string, accountName: string): ExpertReconciliationView {
  return {
    pending: false,
    accountId,
    accountName,
    balances: { book: null, statement: null, gap: null },
    counts: { auto: 0, suggestion: 0, todo: 0 },
    lines: [],
    events: [],
    settings: DEFAULT_RECONCILIATION_SETTINGS,
  };
}
