"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { previewOrganizationBackupAction, restoreOrganizationBackupAction, type BackupActionState, type BackupPreview } from "@/lib/backup/actions";

const initial: BackupActionState = {};

export function OrganizationBackupPanel({ organizationName, demoPreview }: { organizationName: string; demoPreview?: BackupPreview }) {
  const [previewState, previewAction, previewPending] = useActionState(previewOrganizationBackupAction, initial);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreOrganizationBackupAction, initial);
  const preview = demoPreview ?? previewState.preview;
  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5" aria-labelledby="sauvegarde-locale">
      <div>
        <h2 id="sauvegarde-locale" className="text-base font-semibold text-[var(--foreground)]">Sauvegarde locale</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Téléchargez les données de cette entreprise, puis restaurez ce fichier en cas d’erreur. Le mode par défaut ajoute les manquants et met à jour par identifiant. Il ne supprime rien. Les pièces jointes sont citées, pas recopiées.</p>
      </div>
      {/* Fichier ZIP, pas une navigation de page. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/exports/sauvegarde" className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[#2454D8] px-4 text-sm font-semibold text-white">Télécharger la sauvegarde</a>
      <form className="space-y-4">
        <label className="block text-sm font-medium">Fichier de sauvegarde (.zip)
          <input name="file" type="file" accept=".zip,application/zip" required={!demoPreview} className="mt-1 block w-full text-sm" />
        </label>
        <Button type="submit" formAction={previewAction} variant="secondary" disabled={previewPending}>{previewPending ? "Lecture…" : "Prévisualiser la restauration"}</Button>
        {previewState.error ? <p className="text-sm text-red-700" role="alert">{previewState.error}</p> : null}
        {preview ? <BackupPreviewView preview={preview} organizationName={organizationName} restoreAction={restoreAction} restorePending={restorePending} restoreError={restoreState.error} restored={restoreState.restored} /> : null}
      </form>
    </section>
  );
}

export function BackupPreviewView({
  preview,
  organizationName,
  restoreAction,
  restorePending,
  restoreError,
  restored,
}: {
  preview: BackupPreview;
  organizationName: string;
  restoreAction: (formData: FormData) => void;
  restorePending: boolean;
  restoreError?: string;
  restored?: { mode: "merge" | "replace"; skipped: number };
}) {
  const foreign = preview.counts.reduce((sum, item) => sum + item.foreignOrganizationRows, 0);
  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold">Aperçu avant restauration</h3>
      <p className="text-sm">Sauvegarde du {new Date(preview.createdAt).toLocaleString("fr-FR", { timeZone: "UTC" })} · {preview.organizationName}</p>
      <p className="text-sm text-[var(--muted)]">Les lignes sont réécrites vers l’entreprise ouverte, même si le fichier cite une autre organisation.{foreign ? ` ${foreign} ligne${foreign > 1 ? "s" : ""} citai${foreign > 1 ? "ent" : "t"} une autre organisation.` : ""}</p>
      <ul className="space-y-1 text-sm">
        {preview.counts.map((item) => <li key={item.name}>{item.label} : {item.incoming}</li>)}
      </ul>
      {preview.omitted.length > 0 ? <p className="text-sm text-[var(--muted)]">{preview.omitted.length} table{preview.omitted.length > 1 ? "s" : ""} absente{preview.omitted.length > 1 ? "s" : ""} de ce fichier.</p> : null}
      {restored ? <p className="text-sm text-emerald-800" role="status">Restauration {restored.mode === "replace" ? "par remplacement" : "sans suppression"} terminée.{restored.skipped ? ` ${restored.skipped} ligne${restored.skipped > 1 ? "s" : ""} laissée${restored.skipped > 1 ? "s" : ""} de côté.` : ""}</p> : null}
      <Button type="submit" formAction={restoreAction} name="mode" value="merge" disabled={restorePending}>{restorePending ? "Restauration…" : "Restaurer sans supprimer"}</Button>
      <div className="space-y-3 border-t border-[var(--border)] pt-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmReplace" value="oui" className="mt-1" />
          <span>Je remplace les données de cette entreprise par le fichier. Je télécharge d’abord la sauvegarde de l’état actuel.</span>
        </label>
        <label className="block text-sm">Recopiez le nom de l’entreprise : {organizationName}
          <input name="confirmName" className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2" autoComplete="off" />
        </label>
        <Button type="submit" formAction={restoreAction} name="mode" value="replace" variant="secondary" disabled={restorePending}>Remplacer après double confirmation</Button>
      </div>
      {restoreError ? <p className="text-sm text-red-700" role="alert">{restoreError}</p> : null}
    </div>
  );
}
