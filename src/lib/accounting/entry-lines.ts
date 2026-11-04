import type { SupabaseClient } from "@supabase/supabase-js";

export type ExportLine = {
  id: string;
  accountCode: string;
  accountLabel: string;
  debit: number;
  credit: number;
  label: string;
  entryId: string | null;
};

/** Lecture paginée. Le plafond évite une réponse sans fin ; truncated le signale. */
export async function loadAccountingLines(supabase: SupabaseClient, organizationId: string, maxRows = 20000) {
  const rows: ExportLine[] = [];
  for (let offset = 0; offset < maxRows; offset += 1000) {
    const { data, error } = await supabase
      .from("accounting_entry_lines")
      .select("id, account_code, account_label, debit, credit, label, entry_id")
      .eq("organization_id", organizationId)
      .order("id")
      .range(offset, offset + 999);
    if (error) return { rows, error: error.message, truncated: false };
    for (const line of data ?? []) {
      rows.push({
        id: String(line.id),
        accountCode: String(line.account_code ?? ""),
        accountLabel: String(line.account_label ?? ""),
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        label: String(line.label ?? ""),
        entryId: line.entry_id ? String(line.entry_id) : null,
      });
    }
    if ((data?.length ?? 0) < 1000) return { rows, error: null, truncated: false };
  }
  return { rows, error: null, truncated: true };
}

export async function loadEntryHeaders(supabase: SupabaseClient, organizationId: string, entryIds: string[]) {
  const headers = new Map<string, { number: string; date: string; journalCode: string; journalLabel: string }>();
  for (let index = 0; index < entryIds.length; index += 200) {
    const slice = entryIds.slice(index, index + 200);
    const { data, error } = await supabase
      .from("accounting_entries")
      .select("id, entry_number, entry_date, journal:accounting_journals(code, name)")
      .eq("organization_id", organizationId)
      .in("id", slice);
    if (error) return { headers, error: error.message };
    for (const entry of data ?? []) {
      const journal = entry.journal as { code?: string; name?: string } | { code?: string; name?: string }[] | null;
      const journalRow = Array.isArray(journal) ? journal[0] : journal;
      headers.set(String(entry.id), {
        number: String(entry.entry_number ?? ""),
        date: String(entry.entry_date ?? "").slice(0, 10),
        journalCode: journalRow?.code || "OD",
        journalLabel: journalRow?.name || "Journal",
      });
    }
  }
  return { headers, error: null };
}
