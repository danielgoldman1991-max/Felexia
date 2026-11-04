import type { SupabaseClient } from "@supabase/supabase-js";

export type ExportLine = {
  id: string;
  accountCode: string;
  accountLabel: string;
  debit: number;
  credit: number;
  label: string;
  entryId: string | null;
  letter?: string | null;
  letterDate?: string | null;
  auxiliaryId?: string | null;
};

const LINE_COLUMNS = "id, account_code, account_label, debit, credit, label, entry_id, lettering_code, lettering_date, auxiliary_id";
const LINE_COLUMNS_PLAIN = "id, account_code, account_label, debit, credit, label, entry_id";

function missingLetteringColumns(error: { code?: string; message?: string }) {
  return error.code === "42703" || error.code === "PGRST204" || /lettering_|auxiliary_id/i.test(error.message ?? "");
}

/** Lecture paginée. Le plafond évite une réponse sans fin ; truncated le signale. */
export async function loadAccountingLines(supabase: SupabaseClient, organizationId: string, maxRows = 20000) {
  const rows: ExportLine[] = [];
  let columns = LINE_COLUMNS;
  let offset = 0;
  while (offset < maxRows) {
    const { data, error } = await supabase
      .from("accounting_entry_lines")
      .select(columns)
      .eq("organization_id", organizationId)
      .order("id")
      .range(offset, offset + 999);
    if (error) {
      if (columns !== LINE_COLUMNS_PLAIN && missingLetteringColumns(error)) {
        columns = LINE_COLUMNS_PLAIN;
        continue;
      }
      return { rows, error: error.message, truncated: false };
    }
    for (const line of data ?? []) {
      const record = line as unknown as {
        id: string;
        account_code?: string | null;
        account_label?: string | null;
        debit?: number | null;
        credit?: number | null;
        label?: string | null;
        entry_id?: string | null;
        lettering_code?: string | null;
        lettering_date?: string | null;
        auxiliary_id?: string | null;
      };
      rows.push({
        id: String(record.id),
        accountCode: String(record.account_code ?? ""),
        accountLabel: String(record.account_label ?? ""),
        debit: Number(record.debit ?? 0),
        credit: Number(record.credit ?? 0),
        label: String(record.label ?? ""),
        entryId: record.entry_id ? String(record.entry_id) : null,
        letter: record.lettering_code ?? null,
        letterDate: record.lettering_date ? String(record.lettering_date).slice(0, 10) : null,
        auxiliaryId: record.auxiliary_id ? String(record.auxiliary_id) : null,
      });
    }
    if ((data?.length ?? 0) < 1000) return { rows, error: null, truncated: false };
    offset += 1000;
  }
  return { rows, error: null, truncated: true };
}

export async function loadAccountingAuxiliaries(supabase: SupabaseClient, organizationId: string, ids: string[]) {
  const found = new Map<string, { code: string; name: string }>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 200) {
    const slice = unique.slice(index, index + 200);
    const { data, error } = await supabase
      .from("accounting_auxiliaries")
      .select("id, code, name")
      .eq("organization_id", organizationId)
      .in("id", slice);
    if (error) return found;
    for (const row of data ?? []) {
      found.set(String(row.id), { code: String(row.code ?? ""), name: String(row.name ?? "") });
    }
  }
  return found;
}

export type EntryHeader = {
  number: string;
  date: string;
  journalCode: string;
  journalLabel: string;
  sourceType: string | null;
  sourceId: string | null;
};

export async function loadEntryHeaders(supabase: SupabaseClient, organizationId: string, entryIds: string[]) {
  const headers = new Map<string, EntryHeader>();
  for (let index = 0; index < entryIds.length; index += 200) {
    const slice = entryIds.slice(index, index + 200);
    const { data, error } = await supabase
      .from("accounting_entries")
      .select("id, entry_number, entry_date, source_document_type, source_document_id, journal:accounting_journals(code, name)")
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
        sourceType: entry.source_document_type ? String(entry.source_document_type) : null,
        sourceId: entry.source_document_id ? String(entry.source_document_id) : null,
      });
    }
  }
  return { headers, error: null };
}
