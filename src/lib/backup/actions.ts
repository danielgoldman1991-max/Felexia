"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { hasFullErpAccess } from "@/lib/launch-access";
import { describeRestoreFailure, planOrganizationRestore, readOrganizationBackup, replacementAuthorized, RESTORE_BATCH_ROWS, replaceConfirmationReady, type BackupTableName } from "@/lib/backup/org-backup";
import { buildRestoreSteps, restoreProgress } from "@/lib/backup/restore-steps";
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

export type RestoreBatchResult = {
  error?: string;
  written: number;
  skipped: number;
  insertedInvoiceIds: string[];
};

export async function applyOrganizationRestoreBatch(input: {
  organizationId: string;
  backup: Awaited<ReturnType<typeof readOrganizationBackup>>;
  includeHr: boolean;
  table: string;
  mode: "merge" | "delete";
  offset: number;
  freshInvoiceIds: string[];
}): Promise<RestoreBatchResult> {
  const empty = { written: 0, skipped: 0, insertedInvoiceIds: [] as string[] };
  const plan = planOrganizationRestore(input.backup, input.organizationId, input.mode === "delete" ? "replace" : "merge", { includeHr: input.includeHr });
  const selected = plan.tables.find((item) => item.name === input.table);
  if (!selected) return empty;
  const rows = input.mode === "delete" ? [] : selected.rows.slice(input.offset, input.offset + RESTORE_BATCH_ROWS);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_organization_backup_batch", {
    p_organization_id: input.organizationId,
    p_mode: input.mode,
    p_table: input.table as BackupTableName,
    p_rows: rows,
    p_fresh_invoice_ids: [],
  });
  if (error) {
    const described = describeRestoreFailure(error.message, error.code);
    console.error("[organization-restore] blocked", {
      organizationId: input.organizationId,
      table: described.table ?? input.table,
      sqlstate: described.sqlstate,
    });
    return { ...empty, error: described.userMessage };
  }
  const payload = typeof data === "object" && data ? data as { written?: number; skipped?: number; insertedInvoiceIds?: string[] } : {};
  revalidatePath("/parametres");
  return {
    written: Number(payload.written ?? 0),
    skipped: Number(payload.skipped ?? 0),
    insertedInvoiceIds: [],
  };
}

export type RestoreStepResult = {
  error?: string;
  done: boolean;
  progress: string;
  step: number;
  total: number;
  written: number;
  skipped: number;
};

export async function executePlannedRestoreStep(input: {
  organizationId: string;
  organizationName: string;
  backup: Awaited<ReturnType<typeof readOrganizationBackup>>;
  includeHr: boolean;
  mode: "merge" | "replace";
  step: number;
  confirmReplace: string | null;
  confirmName: string | null;
}): Promise<RestoreStepResult> {
  const plan = planOrganizationRestore(input.backup, input.organizationId, input.mode, { includeHr: input.includeHr });
  const steps = buildRestoreSteps(plan, input.mode);
  const blank = { done: false, progress: "", step: input.step, total: steps.length, written: 0, skipped: 0 };
  if (input.mode === "replace" && !replacementAuthorized({
    confirmReplace: input.confirmReplace,
    confirmName: input.confirmName,
    organizationName: input.organizationName,
  })) {
    return { ...blank, error: "Pour remplacer, cochez la confirmation et recopiez exactement le nom de l’entreprise. Rien n’a été modifié." };
  }
  if (input.step >= steps.length) return { ...blank, done: true };
  const current = steps[input.step];
  const progress = restoreProgress(current, input.step, steps.length);
  const rows = (name: string) => plan.tables.find((table) => table.name === name)?.rows ?? [];
  const supabase = await createClient();
  const failed = (message: string | null | undefined, code: string | null | undefined) => {
    const described = describeRestoreFailure(message, code);
    console.error("[organization-restore] blocked", { organizationId: input.organizationId, table: current.parent, sqlstate: described.sqlstate });
    return { ...blank, progress, error: described.userMessage };
  };
  if (current.phase === "rehearse" && current.probe === "external") {
    const { error } = await supabase.rpc("restore_organization_backup_bundle", {
      p_organization_id: input.organizationId,
      p_mode: "rehearse",
      p_parent: current.parent,
      p_parents: [],
      p_child: current.child ?? null,
      p_child_key: current.childKey ?? null,
      p_children: [],
      p_keep_ids: current.parentIds,
      p_confirm: null,
      p_confirm_name: null,
      p_include_pro: input.includeHr,
    });
    if (error) return failed(error.message, error.code);
    revalidatePath("/parametres");
    const probed = input.step + 1;
    return { done: probed >= steps.length, progress, step: probed, total: steps.length, written: 0, skipped: 0 };
  }
  const bundleMode = current.phase === "write" ? input.mode : current.phase;
  const confirmation = bundleMode === "replace" || bundleMode === "purge"
    ? { p_confirm: input.confirmReplace, p_confirm_name: input.confirmName }
    : { p_confirm: null, p_confirm_name: null };
  if (current.child && current.childKey) {
    const ids = new Set(current.parentIds);
    const parents = current.phase === "purge" ? [] : rows(current.parent).filter((row) => ids.has(String(row.id ?? "")));
    const children = current.phase === "purge" ? [] : rows(current.child).filter((row) => ids.has(String(row[current.childKey!] ?? "")));
    const { error } = await supabase.rpc("restore_organization_backup_bundle", {
      p_organization_id: input.organizationId,
      p_mode: bundleMode,
      p_parent: current.parent,
      p_parents: parents,
      p_child: current.child,
      p_child_key: current.childKey,
      p_children: children,
      p_keep_ids: current.phase === "purge" ? current.parentIds : [],
      ...confirmation,
      p_include_pro: input.includeHr,
    });
    if (error) return failed(error.message, error.code);
  } else if (current.phase === "purge") {
    const { error } = await supabase.rpc("restore_organization_backup_bundle", {
      p_organization_id: input.organizationId,
      p_mode: "purge",
      p_parent: current.parent,
      p_parents: [],
      p_child: null,
      p_child_key: null,
      p_children: [],
      p_keep_ids: current.parentIds,
      ...confirmation,
      p_include_pro: input.includeHr,
    });
    if (error) return failed(error.message, error.code);
  } else {
    const source = rows(current.parent);
    const slice = current.offset == null ? source : source.slice(current.offset, current.offset + RESTORE_BATCH_ROWS);
    const { error } = await supabase.rpc("restore_organization_backup_batch", {
      p_organization_id: input.organizationId,
      p_mode: "merge",
      p_table: current.parent,
      p_rows: slice,
      p_fresh_invoice_ids: [],
    });
    if (error) return failed(error.message, error.code);
  }
  revalidatePath("/parametres");
  const next = input.step + 1;
  return { done: next >= steps.length, progress, step: next, total: steps.length, written: 0, skipped: 0 };
}

export async function restoreBackupStepAction(formData: FormData): Promise<RestoreStepResult> {
  const fail = (error: string): RestoreStepResult => ({ error, done: false, progress: "", step: 0, total: 0, written: 0, skipped: 0 });
  try {
    const workspace = await adminWorkspace();
    const mode = formData.get("mode") === "replace" ? "replace" : "merge";
    const step = Number(formData.get("step") ?? 0);
    const includeHr = await hasFullErpAccess(workspace.organization.id);
    const backup = await backupFrom(formData);
    return await executePlannedRestoreStep({
      organizationId: workspace.organization.id,
      organizationName: workspace.organization.name,
      backup,
      includeHr,
      mode,
      step: Number.isFinite(step) ? step : 0,
      confirmReplace: String(formData.get("confirmReplace") ?? ""),
      confirmName: String(formData.get("confirmName") ?? ""),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Cette étape a été annulée. Les étapes déjà réussies ne créent pas de doublon.");
  }
}

export async function restoreBackupBatchAction(formData: FormData): Promise<RestoreBatchResult> {
  const empty = { written: 0, skipped: 0, insertedInvoiceIds: [] as string[] };
  try {
    const workspace = await adminWorkspace();
    const mode = formData.get("batch") === "delete" ? "delete" : "merge";
    if (mode === "delete" && !replacementAuthorized({
      confirmReplace: String(formData.get("confirmReplace") ?? ""),
      confirmName: String(formData.get("confirmName") ?? ""),
      organizationName: workspace.organization.name,
    })) {
      return { ...empty, error: "Pour remplacer, cochez la confirmation et recopiez exactement le nom de l’entreprise. Rien n’a été modifié." };
    }
    const table = String(formData.get("table") ?? "");
    const offset = Number(formData.get("offset") ?? 0);
    let freshInvoiceIds: string[] = [];
    try {
      const parsed = JSON.parse(String(formData.get("freshInvoiceIds") ?? "[]"));
      freshInvoiceIds = Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return { ...empty, error: "La reprise de la restauration est illisible. Relancez depuis le début." };
    }
    const includeHr = await hasFullErpAccess(workspace.organization.id);
    const backup = await backupFrom(formData);
    return await applyOrganizationRestoreBatch({
      organizationId: workspace.organization.id,
      backup,
      includeHr,
      table,
      mode,
      offset,
      freshInvoiceIds,
    });
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "Cette étape a été annulée. Les étapes déjà réussies ne créent pas de doublon." };
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
