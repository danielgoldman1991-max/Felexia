"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { previewOrganizationBackupAction, restoreBackupStepAction, type BackupActionState, type BackupPreview } from "@/lib/backup/actions";
import { replaceConfirmationReady } from "@/lib/backup/org-backup";

const initial: BackupActionState = {};

type ResumePoint = { step: number };

export function OrganizationBackupPanel({ organizationName, demoPreview }: { organizationName: string; demoPreview?: BackupPreview }) {
  const [previewState, previewAction, previewPending] = useActionState(previewOrganizationBackupAction, initial);
  const preview = demoPreview ?? previewState.preview;
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5" aria-labelledby="sauvegarde-locale">
      <div>
        <h2 id="sauvegarde-locale" className="text-base font-semibold text-[var(--foreground)]">Sauvegarde locale</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Téléchargez les données de cette entreprise, puis restaurez ce fichier en cas d’erreur. Le mode par défaut ajoute les manquants et met à jour par identifiant. Il ne supprime rien. Les pièces jointes sont citées, pas recopiées.</p>
      </div>
      {/* Fichier ZIP, pas une navigation de page. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/exports/sauvegarde" className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[#2454D8] px-4 text-sm font-semibold text-white">Télécharger la sauvegarde</a>
      <form action={previewAction} className="space-y-4">
        <label className="block text-sm font-medium">Fichier de sauvegarde (.zip)
          <input ref={fileRef} name="file" type="file" accept=".zip,application/zip" required={!demoPreview} className="mt-1 block w-full text-sm" />
        </label>
        <Button type="submit" variant="secondary" disabled={previewPending}>{previewPending ? "Lecture…" : "Prévisualiser la restauration"}</Button>
        {previewState.error ? <p className="text-sm text-red-700" role="alert">{previewState.error}</p> : null}
      </form>
      {preview ? (
        <BackupPreviewView
          preview={preview}
          organizationName={organizationName}
          runBatch={restoreBackupStepAction}
          seedForm={() => {
            const data = new FormData();
            const file = fileRef.current?.files?.[0];
            if (file) data.set("file", file);
            return data;
          }}
        />
      ) : null}
    </section>
  );
}

export function BackupPreviewView({
  preview,
  organizationName,
  runBatch,
  seedForm,
}: {
  preview: BackupPreview;
  organizationName: string;
  runBatch: (formData: FormData) => Promise<{ error?: string; done: boolean; progress: string; step: number }>;
  seedForm: () => FormData;
}) {
  const foreign = preview.counts.reduce((sum, item) => sum + item.foreignOrganizationRows, 0);
  const [replaceChecked, setReplaceChecked] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ mode: "merge" | "replace"; skipped: number }>();
  const [resume, setResume] = useState<ResumePoint | null>(null);
  const safetyReady = useRef(false);
  const replaceReady = replaceConfirmationReady(replaceChecked, typedName, organizationName);

  async function downloadSafetyCopy() {
    const response = await fetch("/api/exports/sauvegarde", { credentials: "same-origin" });
    if (!response.ok) throw new Error("La sauvegarde de sécurité n’a pas pu être téléchargée. Le remplacement n’a pas commencé.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "felexia-sauvegarde-avant-remplacement.zip";
    link.click();
    URL.revokeObjectURL(url);
    safetyReady.current = true;
  }

  async function restore(mode: "merge" | "replace", continued: ResumePoint | null) {
    const probe = seedForm();
    if (!probe.get("file") && !probe.get("runId")) {
      setError("Choisissez un fichier de sauvegarde.");
      return;
    }
    setRunning(true);
    setError(undefined);
    setDone(undefined);
    let step = continued?.step ?? 0;
    try {
      if (mode === "replace" && !continued) {
        setProgress("Téléchargement de la sauvegarde de sécurité…");
        await downloadSafetyCopy();
      }
      while (true) {
        const data = seedForm();
        data.set("mode", mode);
        data.set("step", String(step));
        if (mode === "replace") {
          data.set("confirmReplace", replaceChecked ? "oui" : "");
          data.set("confirmName", typedName);
        }
        const result = await runBatch(data);
        if (result.error) {
          setResume({ step });
          throw new Error(interrupted(mode, result.progress || "cette étape", result.error, safetyReady.current));
        }
        if (result.progress) setProgress(result.progress);
        if (result.done) break;
        step = result.step;
      }
      setResume(null);
      setProgress("");
      setDone({ mode, skipped: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La restauration s’est interrompue.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold">Aperçu avant restauration</h3>
      <p className="text-sm">Sauvegarde du {new Date(preview.createdAt).toLocaleString("fr-FR", { timeZone: "UTC" })} · {preview.organizationName}</p>
      <p className="text-sm text-[var(--muted)]">Les lignes sont réécrites vers l’entreprise ouverte, même si le fichier cite une autre organisation.{foreign ? ` ${foreign} ligne${foreign > 1 ? "s" : ""} citai${foreign > 1 ? "ent" : "t"} une autre organisation.` : ""}</p>
      <ul className="space-y-1 text-sm">
        {preview.counts.map((item) => <li key={item.name}>{item.label} : {item.incoming}</li>)}
      </ul>
      {preview.omitted.length > 0 ? <p className="text-sm text-[var(--muted)]">{preview.omitted.map((item) => item.reason).filter((reason, index, all) => all.indexOf(reason) === index).join(" ")}</p> : null}
      {progress ? <p className="text-sm font-medium" role="status">{progress}</p> : null}
      {done ? <p className="text-sm text-emerald-800" role="status">Restauration {done.mode === "replace" ? "par remplacement" : "sans suppression"} terminée.{done.skipped ? ` ${done.skipped} ligne${done.skipped > 1 ? "s" : ""} laissée${done.skipped > 1 ? "s" : ""} de côté.` : ""}</p> : null}
      <Button type="button" onClick={() => restore("merge", null)} disabled={running}>{running ? "Restauration…" : "Restaurer sans supprimer"}</Button>
      <div className="space-y-3 border-t border-[var(--border)] pt-3">
        <p className="text-sm text-[var(--muted)]">Le remplacement commence par un essai à blanc, sans rien effacer. Ensuite chaque table est retirée seulement au moment de la réécrire. S’il s’interrompt, les données peuvent être incomplètes : relancez le même fichier, ou restaurez la sauvegarde téléchargée.</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmReplace" value="oui" className="mt-1" checked={replaceChecked} onChange={(event) => setReplaceChecked(event.target.checked)} />
          <span>Je remplace les données de cette entreprise par le fichier. Je télécharge d’abord la sauvegarde de l’état actuel.</span>
        </label>
        <label className="block text-sm">Recopiez le nom de l’entreprise : {organizationName}
          <input name="confirmName" value={typedName} onChange={(event) => setTypedName(event.target.value)} className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2" autoComplete="off" />
        </label>
        <Button type="button" variant="secondary" onClick={() => restore("replace", null)} disabled={running || !replaceReady}>Remplacer après double confirmation</Button>
      </div>
      {resume ? <Button type="button" variant="secondary" onClick={() => restore(replaceChecked ? "replace" : "merge", resume)} disabled={running}>Reprendre la restauration</Button> : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

function interrupted(mode: "merge" | "replace", label: string, detail: string, safety: boolean) {
  if (mode === "replace") {
    return `Le remplacement s’est interrompu pendant « ${label} ». ${safety ? "Une sauvegarde de l’état d’avant le remplacement a été téléchargée. " : ""}Les données peuvent être incomplètes. Relancez le remplacement avec le même fichier, ou restaurez cette sauvegarde. ${detail}`;
  }
  return `La restauration s’est interrompue pendant « ${label} ». Cette étape n’a pas été enregistrée. Relancez : les étapes déjà réussies ne créent pas de doublon. ${detail}`;
}
