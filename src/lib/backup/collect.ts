import { BACKUP_TABLES, buildOrganizationBackup, PRO_BACKUP_OMITTED_REASON, type BackupTableName } from "@/lib/backup/org-backup";

type TableQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      order: (column: string) => {
        range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
  };
};

async function readTable(supabase: { from: (table: string) => TableQuery }, table: string, organizationId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").eq("organization_id", organizationId).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

/** Same ZIP as the manual download: one JSON per table, manifest and checksums. */
export async function collectOrganizationBackup(
  supabase: unknown,
  input: { organizationId: string; organizationName: string; includeHr: boolean; createdAt?: string },
) {
  const reader = supabase as { from: (table: string) => TableQuery };
  const tables: { name: BackupTableName; rows: Record<string, unknown>[] }[] = [];
  const omitted: { name: string; reason: string }[] = [];
  for (const table of BACKUP_TABLES) {
    if (table.name.startsWith("hr_") && !input.includeHr) {
      omitted.push({ name: table.name, reason: PRO_BACKUP_OMITTED_REASON });
      continue;
    }
    tables.push({ name: table.name, rows: await readTable(reader, table.name, input.organizationId) });
  }
  return buildOrganizationBackup({
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    createdAt: input.createdAt ?? new Date().toISOString(),
    tables,
    omitted,
  });
}
