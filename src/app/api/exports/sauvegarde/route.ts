import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { BACKUP_TABLES, buildOrganizationBackup, type BackupTableName } from "@/lib/backup/org-backup";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function readTable(supabase: Awaited<ReturnType<typeof createClient>>, table: string, organizationId: string) {
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

export async function GET() {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) {
    return new Response("Réservé au propriétaire ou à l’administrateur de l’entreprise.", { status: 403 });
  }
  const organizationId = workspace.organization.id;
  const supabase = await createClient();
  const includeHr = await hasFullErpAccess(organizationId);
  const tables: { name: BackupTableName; rows: Record<string, unknown>[] }[] = [];
  const omitted: { name: string; reason: string }[] = [];
  for (const table of BACKUP_TABLES) {
    if (table.name === "hr_employees" && !includeHr) {
      omitted.push({ name: table.name, reason: "Les salariés sont réservés à l’offre PRO." });
      continue;
    }
    try {
      tables.push({ name: table.name, rows: await readTable(supabase, table.name, organizationId) });
    } catch {
      omitted.push({ name: table.name, reason: "Cette table n’est pas disponible pour l’entreprise." });
    }
  }
  const backup = buildOrganizationBackup({
    organizationId,
    organizationName: workspace.organization.name,
    createdAt: new Date().toISOString(),
    tables,
    omitted,
  });
  const stamp = backup.manifest.createdAt.slice(0, 10);
  return new Response(new Uint8Array(backup.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="felexia-sauvegarde-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
