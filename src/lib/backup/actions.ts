"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { hasFullErpAccess } from "@/lib/launch-access";
import { describeRestoreFailure, planOrganizationRestore, readOrganizationBackup, replaceConfirmationReady } from "@/lib/backup/org-backup";
import { createClient } from "@/lib/supabase/server";

export type BackupPreview = {
  createdAt: string;
  organizationName: string;
  sourceOrganizationId: string;
  counts: { name: string; label: string; incoming: number; foreignOrganizationRows: number }[];
  omitted: { name: string; reason: string }[];
};

export type BackupActionState = {
  error?: string;
  preview?: BackupPreview;
  runId?: string;
  restored?: { mode: "merge" | "replace"; skipped: number };
};

async function adminWorkspace() {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) throw new Error("Réservé au propriétaire ou à l’administrateur de l’entreprise.");
  return workspace;
}

async function backupFrom(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) throw new Error("Choisissez un fichier de sauvegarde.");
  if (file.size > 8_000_000) throw new Error("Le fichier dépasse 8 Mo. Découpez l’export ou contactez le support.");
  return readOrganizationBackup(Buffer.from(await file.arrayBuffer()));
}

export async function previewOrganizationBackupAction(_prev: BackupActionState, formData: FormData): Promise<BackupActionState> {
  try {
    const workspace = await adminWorkspace();
    const backup = await backupFrom(formData);
    const includeHr = await hasFullErpAccess(workspace.organization.id);
    const plan = planOrganizationRestore(backup, workspace.organization.id, "merge", { includeHr });
    return {
      preview: {
        createdAt: backup.manifest.createdAt,
        organizationName: backup.manifest.organizationName,
        sourceOrganizationId: backup.manifest.organizationId,
        counts: plan.counts,
        omitted: [...backup.manifest.omitted, ...plan.omitted],
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La sauvegarde n’a pas pu être lue." };
  }
}

export async function restoreOrganizationBackupAction(_prev: BackupActionState, formData: FormData): Promise<BackupActionState> {
  try {
    const workspace = await adminWorkspace();
    const mode = formData.get("mode") === "replace" ? "replace" : "merge";
    if (mode === "replace" && !replaceConfirmationReady(formData.get("confirmReplace") === "oui", String(formData.get("confirmName") ?? ""), workspace.organization.name)) {
      return { error: "Pour remplacer, cochez la confirmation et recopiez exactement le nom de l’entreprise. Rien n’a été modifié." };
    }
    const includeHr = await hasFullErpAccess(workspace.organization.id);
    const backup = await backupFrom(formData);
    const plan = planOrganizationRestore(backup, workspace.organization.id, mode, { includeHr });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("restore_organization_backup", {
      p_organization_id: workspace.organization.id,
      p_mode: mode,
      p_tables: plan.tables,
    });
    if (error) {
      const described = describeRestoreFailure(error.message, error.code);
      console.error("[organization-restore] blocked", {
        organizationId: workspace.organization.id,
        table: described.table,
        sqlstate: described.sqlstate,
      });
      return { error: described.userMessage };
    }
    revalidatePath("/parametres");
    const skipped = typeof data === "object" && data && "skipped" in data ? Number(data.skipped) : 0;
    return { restored: { mode, skipped: Number.isFinite(skipped) ? skipped : 0 } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La restauration a échoué. Aucune donnée n’a été modifiée." };
  }
}
