import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { PageHeader } from "@/components/erp/page-header";
import { OrganizationBackupPanel } from "@/components/settings/organization-backup-panel";
import { ScheduledBackupPanel, type ScheduledBackupRun, type ScheduledBackupValues } from "@/components/settings/scheduled-backup-panel";
import { ThirdPartyImportForm } from "@/components/tiers/third-party-import-form";
import { formatBackupWhen, nextBackupRun, type BackupScheduleInput } from "@/lib/backup/schedule";
import { createClient } from "@/lib/supabase/server";

const EMPTY: ScheduledBackupValues = {
  enabled: false,
  frequency: "daily",
  weekdays: [1, 2, 3, 4, 5],
  monthDay: 1,
  time: "02:00",
  retentionCount: 7,
  nextLabel: null,
};

export default async function OrganizationBackupPage() {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) {
    return (
      <div className="space-y-4">
        <PageHeader title="Accès réservé aux administrateurs" description="La sauvegarde et l’import sont réservés au propriétaire et à l’administrateur de l’entreprise." />
        <Link href="/dashboard" className="text-sm font-medium text-[var(--primary)] hover:underline">Retour au tableau de bord</Link>
      </div>
    );
  }
  const loaded = await loadSchedule(workspace.organization.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Sauvegarde et import" description="Réservé au propriétaire et à l’administrateur. Tout reste limité à l’entreprise ouverte." />
      <div className="grid gap-4 xl:grid-cols-2">
        <OrganizationBackupPanel organizationName={workspace.organization.name} />
        <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5" aria-labelledby="import-clients">
          <div>
            <h2 id="import-clients" className="text-base font-semibold">Import clients</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Excel .xlsx, .xls ou CSV. Le modèle contient les colonnes en français, une ligne fictive et les consignes.</p>
          </div>
          <ThirdPartyImportForm />
        </section>
      </div>
      <ScheduledBackupPanel organizationName={workspace.organization.name} values={loaded.values} runs={loaded.runs} unavailable={loaded.unavailable} />
      <RestoreAuditList organizationId={workspace.organization.id} />
      <Link href="/parametres" className="text-sm font-medium text-[var(--primary)] hover:underline">Retour aux paramètres</Link>
    </div>
  );
}

async function loadSchedule(organizationId: string): Promise<{ values: ScheduledBackupValues; runs: ScheduledBackupRun[]; unavailable: boolean }> {
  const supabase = await createClient();
  const [{ data: row, error: scheduleError }, { data: runs, error: runsError }] = await Promise.all([
    supabase.from("organization_backup_schedules").select("enabled, frequency, weekdays, month_day, hour, minute, retention_count").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("organization_backup_runs").select("id, slot_key, status, byte_size, error_message").eq("organization_id", organizationId).order("started_at", { ascending: false }).limit(30),
  ]);
  if (scheduleError || runsError) return { values: EMPTY, runs: [], unavailable: true };
  if (!row) return { values: EMPTY, runs: presentRuns(runs ?? []), unavailable: false };
  const schedule: BackupScheduleInput = {
    enabled: row.enabled,
    frequency: row.frequency === "weekly" || row.frequency === "monthly" ? row.frequency : "daily",
    weekdays: row.weekdays ?? [1],
    monthDay: row.month_day,
    hour: row.hour,
    minute: row.minute,
    retentionCount: row.retention_count,
  };
  const next = nextBackupRun(schedule, new Date());
  return {
    unavailable: false,
    runs: presentRuns(runs ?? []),
    values: {
      enabled: schedule.enabled,
      frequency: schedule.frequency,
      weekdays: schedule.weekdays,
      monthDay: schedule.monthDay,
      time: `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`,
      retentionCount: schedule.retentionCount,
      nextLabel: next ? `${formatBackupWhen(next)} (Casablanca)` : null,
    },
  };
}

async function RestoreAuditList({ organizationId }: { organizationId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_restore_audit")
    .select("id, table_name, document_number, document_status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return <p className="text-sm text-[var(--muted)]">Le journal des factures restaurées sera disponible après l’installation de la migration 152.</p>;
  const rows = data ?? [];
  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      <h2 className="text-base font-semibold">Journal des factures restaurées</h2>
      <p className="text-sm text-[var(--muted)]">Chaque facture validée réécrite par une restauration est notée ici. Seul un administrateur peut le consulter.</p>
      {rows.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune facture validée restaurée pour le moment.</p> : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id}>{row.document_number ?? row.table_name} · {row.document_status} · {new Date(row.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" })}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function presentRuns(rows: { id: string; slot_key: string; status: string; byte_size: number | null; error_message: string | null }[]): ScheduledBackupRun[] {
  return rows.flatMap((row) => {
    if (row.status !== "ok" && row.status !== "failed" && row.status !== "running" && row.status !== "purged") return [];
    return [{ id: row.id, slotKey: row.slot_key, status: row.status, byteSize: row.byte_size, errorMessage: row.error_message }];
  });
}
