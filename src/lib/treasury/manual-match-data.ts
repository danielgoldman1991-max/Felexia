import { requireActiveWorkspace } from "@/lib/auth";
import { isMissingSchema } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";

export type ManualBoardLine = {
  id: string;
  date: string;
  label: string;
  direction: "in" | "out";
  remaining: number;
};

export type ManualBoardDocument = ManualBoardLine & {
  kind: "transaction" | "customer_invoice" | "supplier_invoice";
  party: string;
};

export type ManualBoardMatch = {
  id: string;
  kind: "partial" | "grouped";
  partial: boolean;
  total: number;
  createdAt: string;
  summary: string;
};

export type ManualMatchBoard = {
  accountId: string;
  pendingMigration: boolean;
  lines: ManualBoardLine[];
  documents: ManualBoardDocument[];
  matches: ManualBoardMatch[];
};

const empty = (accountId: string): ManualMatchBoard => ({ accountId, pendingMigration: false, lines: [], documents: [], matches: [] });

export async function loadManualMatchBoard(accountId: string): Promise<ManualMatchBoard> {
  if (!accountId) return empty("");
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  const [linesResult, transactionsResult, customersResult, suppliersResult, allocationsResult, matchesResult] = await Promise.all([
    supabase.from("bank_statement_lines").select("id, operation_date, label, amount, direction").eq("organization_id", orgId).eq("treasury_account_id", accountId).eq("reconciliation_status", "unreconciled").order("operation_date", { ascending: false }).limit(80),
    supabase.from("treasury_transactions").select("id, transaction_date, label, amount, direction, third_party_id").eq("organization_id", orgId).eq("treasury_account_id", accountId).eq("reconciliation_status", "unreconciled").is("archived_at", null).limit(80),
    supabase.from("customer_invoices").select("id, invoice_number, invoice_date, remaining_amount, customer_id").eq("organization_id", orgId).gt("remaining_amount", 0).not("status", "in", "(draft,cancelled)").is("archived_at", null).limit(80),
    supabase.from("supplier_invoices").select("id, invoice_number, supplier_invoice_number, invoice_date, remaining_amount, supplier_id").eq("organization_id", orgId).gt("remaining_amount", 0).in("status", ["validated", "partially_paid"]).is("archived_at", null).limit(80),
    supabase.from("bank_manual_match_lines").select("statement_line_id, amount, match:match_id(status)").eq("organization_id", orgId),
    supabase.from("bank_manual_matches").select("id, kind, is_partial, total_amount, created_at, status").eq("organization_id", orgId).eq("treasury_account_id", accountId).eq("status", "confirmed").order("created_at", { ascending: false }).limit(20),
  ]);
  const pendingMigration = [allocationsResult.error, matchesResult.error].some((error) => isMissingSchema(error));
  const usedLines = new Map<string, number>();
  if (!pendingMigration) {
    for (const row of allocationsResult.data ?? []) {
      const match = row.match as { status?: string } | { status?: string }[] | null;
      const status = Array.isArray(match) ? match[0]?.status : match?.status;
      if (status !== "confirmed") continue;
      const id = String(row.statement_line_id);
      usedLines.set(id, (usedLines.get(id) ?? 0) + Number(row.amount ?? 0));
    }
  }
  const documentUse = pendingMigration ? new Map<string, number>() : await usedDocuments(orgId);
  const partyIds = [
    ...(transactionsResult.data ?? []).map((row) => row.third_party_id),
    ...(customersResult.data ?? []).map((row) => row.customer_id),
    ...(suppliersResult.data ?? []).map((row) => row.supplier_id),
  ].filter((id): id is string => Boolean(id));
  const parties = partyIds.length
    ? await supabase.from("third_parties").select("id, name").eq("organization_id", orgId).in("id", [...new Set(partyIds)])
    : { data: [] };
  const partyName = new Map((parties.data ?? []).map((party) => [String(party.id), String(party.name ?? "")]));
  const lines = (linesResult.data ?? []).map((row) => {
    const remaining = round(Number(row.amount) - (usedLines.get(String(row.id)) ?? 0));
    return { id: String(row.id), date: String(row.operation_date), label: String(row.label ?? ""), direction: row.direction === "out" ? "out" as const : "in" as const, remaining };
  }).filter((line) => line.remaining > 0.009);
  const documents: ManualBoardDocument[] = [
    ...(transactionsResult.data ?? []).map((row) => boardDocument("transaction", String(row.id), String(row.transaction_date), String(row.label ?? "Mouvement"), row.direction === "out" ? "out" : "in", Number(row.amount), partyName.get(String(row.third_party_id ?? "")) ?? "", documentUse)),
    ...(customersResult.data ?? []).map((row) => boardDocument("customer_invoice", String(row.id), String(row.invoice_date ?? ""), String(row.invoice_number ?? "Facture"), "in", Number(row.remaining_amount), partyName.get(String(row.customer_id ?? "")) ?? "", documentUse)),
    ...(suppliersResult.data ?? []).map((row) => boardDocument("supplier_invoice", String(row.id), String(row.invoice_date ?? ""), String(row.supplier_invoice_number || row.invoice_number || "Facture"), "out", Number(row.remaining_amount), partyName.get(String(row.supplier_id ?? "")) ?? "", documentUse)),
  ].filter((document) => document.remaining > 0.009);
  const matchIds = (matchesResult.data ?? []).map((row) => String(row.id));
  const summaries = matchIds.length && !pendingMigration ? await matchSummaries(orgId, matchIds) : new Map<string, string>();
  return {
    accountId,
    pendingMigration,
    lines,
    documents,
    matches: pendingMigration ? [] : (matchesResult.data ?? []).map((row) => ({
      id: String(row.id),
      kind: row.kind === "grouped" ? "grouped" : "partial",
      partial: row.is_partial === true,
      total: Number(row.total_amount),
      createdAt: String(row.created_at),
      summary: summaries.get(String(row.id)) ?? "",
    })),
  };
}

function boardDocument(kind: ManualBoardDocument["kind"], id: string, date: string, label: string, direction: "in" | "out", amount: number, party: string, used: Map<string, number>): ManualBoardDocument {
  return { kind, id, date, label, direction, party, remaining: round(amount - (used.get(`${kind}:${id}`) ?? 0)) };
}

async function usedDocuments(organizationId: string) {
  const supabase = await createClient();
  const rows = await supabase.from("bank_manual_match_documents").select("target_type, target_id, amount, match:match_id(status)").eq("organization_id", organizationId);
  const used = new Map<string, number>();
  for (const row of rows.data ?? []) {
    const match = row.match as { status?: string } | { status?: string }[] | null;
    const status = Array.isArray(match) ? match[0]?.status : match?.status;
    if (status !== "confirmed") continue;
    const key = `${row.target_type}:${row.target_id}`;
    used.set(key, (used.get(key) ?? 0) + Number(row.amount ?? 0));
  }
  return used;
}

async function matchSummaries(organizationId: string, matchIds: string[]) {
  const supabase = await createClient();
  const [lines, documents] = await Promise.all([
    supabase.from("bank_manual_match_lines").select("match_id, statement_line_id").eq("organization_id", organizationId).in("match_id", matchIds),
    supabase.from("bank_manual_match_documents").select("match_id, target_type").eq("organization_id", organizationId).in("match_id", matchIds),
  ]);
  const summary = new Map<string, { lines: number; documents: number }>();
  for (const id of matchIds) summary.set(id, { lines: 0, documents: 0 });
  for (const row of lines.data ?? []) {
    const count = summary.get(String(row.match_id));
    if (count) count.lines += 1;
  }
  for (const row of documents.data ?? []) {
    const count = summary.get(String(row.match_id));
    if (count) count.documents += 1;
  }
  return new Map([...summary.entries()].map(([id, count]) => [id, `${count.lines} ligne${count.lines > 1 ? "s" : ""} · ${count.documents} pièce${count.documents > 1 ? "s" : ""}`]));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
