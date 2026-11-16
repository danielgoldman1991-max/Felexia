"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { planOrganizationRestore, readOrganizationBackup } from "@/lib/backup/org-backup";
import { BACKUP_BUCKET, backupPathBelongsTo, parseBackupSchedule } from "@/lib/backup/schedule";
import { createClient } from "@/lib/supabase/server";
import type { BackupActionState } from "@/lib/backup/actions";

export type ScheduleActionState = { error?: string; saved?: boolean };

async function adminWorkspace() {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) throw new Error("Réservé au propriétaire ou à l’administrateur de l’entreprise.");
  return workspace;
}

function missingTable(message: string) {
  return /organization_backup_|schema cache|PGRST205|42P01/i.test(message);
}

export async function saveBackupScheduleAction(_prev: ScheduleActionState, formData: FormData): Promise<ScheduleActionState> {
  try {
    const workspace = await adminWorkspace();
    const schedule = parseBackupSchedule({
      enabled: formData.get("enabled") === "oui",
      frequency: String(formData.get("frequency") ?? ""),
      weekdays: formData.getAll("weekdays").map((value) => Number(value)),
      monthDay: Number(formData.get("monthDay") ?? 1),
      time: String(formData.get("time") ?? ""),
      retentionCount: Number(formData.get("retentionCount") ?? 0),
    });
    const supabase = await createClient();
    const { error } = await supabase.from("organization_backup_schedules").upsert({
      organization_id: workspace.organization.id,
      enabled: schedule.enabled,
      frequency: schedule.frequency,
      weekdays: schedule.weekdays,
      month_day: schedule.monthDay,
      hour: schedule.hour,
      minute: schedule.minute,
      retention_count: schedule.retentionCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    if (error) {
      return { error: missingTable(error.message) ? "La programmation n’est pas encore installée (migration 146). Rien n’a été enregistré." : "Le réglage n’a pas pu être enregistré." };
    }
    revalidatePath("/parametres/sauvegarde");
    return { saved: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Le réglage n’a pas pu être enregistré." };
  }
}

async function storedBackup(organizationId: string, runId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new Error("Sauvegarde introuvable.");
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("organization_backup_runs")
    .select("storage_path, status")
    .eq("id", runId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(missingTable(error.message) ? "L’historique n’est pas encore installé (migration 146)." : "La copie n’a pas pu être lue.");
  if (!run || run.status !== "ok" || !run.storage_path || !backupPathBelongsTo(run.storage_path, organizationId)) throw new Error("Cette copie ne peut pas être relue.");
  const downloaded = await supabase.storage.from(BACKUP_BUCKET).download(run.storage_path);
  if (downloaded.error || !downloaded.data) throw new Error("Le fichier de sauvegarde est introuvable.");
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (bytes.length > 20_971_520) throw new Error("La sauvegarde dépasse 20 Mo.");
  return readOrganizationBackup(bytes);
}

export async function previewScheduledBackupAction(_prev: BackupActionState, formData: FormData): Promise<BackupActionState> {
  try {
    const workspace = await adminWorkspace();
    const runId = String(formData.get("runId") ?? "");
    const backup = await storedBackup(workspace.organization.id, runId);
    const plan = planOrganizationRestore(backup, workspace.organization.id, "merge");
    return {
      runId,
      preview: {
        createdAt: backup.manifest.createdAt,
        organizationName: backup.manifest.organizationName,
        sourceOrganizationId: backup.manifest.organizationId,
        counts: plan.counts,
        omitted: backup.manifest.omitted,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La sauvegarde n’a pas pu être lue." };
  }
}

export async function restoreScheduledBackupAction(_prev: BackupActionState, formData: FormData): Promise<BackupActionState> {
  try {
    const workspace = await adminWorkspace();
    const mode = formData.get("mode") === "replace" ? "replace" : "merge";
    if (mode === "replace") {
      const typed = String(formData.get("confirmName") ?? "").trim();
      if (formData.get("confirmReplace") !== "oui" || typed !== workspace.organization.name) {
        return { error: "Pour remplacer, cochez la confirmation et recopiez exactement le nom de l’entreprise. Rien n’a été modifié.", runId: String(formData.get("runId") ?? "") };
      }
    }
    const backup = await storedBackup(workspace.organization.id, String(formData.get("runId") ?? ""));
    const plan = planOrganizationRestore(backup, workspace.organization.id, mode);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("restore_organization_backup", {
      p_organization_id: workspace.organization.id,
      p_mode: mode,
      p_tables: plan.tables,
    });
    if (error) {
      return { error: /restore_organization_backup|schema cache|PGRST202/i.test(error.message)
        ? "La restauration n’est pas encore installée sur la base (migration 145). Aucune donnée n’a été modifiée."
        : "La restauration a été annulée. Aucune donnée n’a été laissée à moitié importée." };
    }
    revalidatePath("/parametres/sauvegarde");
    const skipped = typeof data === "object" && data && "skipped" in data ? Number(data.skipped) : 0;
    return { restored: { mode, skipped: Number.isFinite(skipped) ? skipped : 0 } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La restauration a échoué. Aucune donnée n’a été modifiée." };
  }
}
