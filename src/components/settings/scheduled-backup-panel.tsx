"use client";

import { useActionState } from "react";
import { BackupPreviewView } from "@/components/settings/organization-backup-panel";
import { Button } from "@/components/ui/button";
import type { BackupActionState } from "@/lib/backup/actions";
import { previewScheduledBackupAction, restoreScheduledBackupAction, saveBackupScheduleAction, type ScheduleActionState } from "@/lib/backup/schedule-actions";
import { WEEKDAY_OPTIONS, backupTimeOptions, formatBackupSize, formatBackupWhen, zonedToUtc, type BackupFrequency } from "@/lib/backup/schedule";

export type ScheduledBackupValues = {
  enabled: boolean;
  frequency: BackupFrequency;
  weekdays: number[];
  monthDay: number;
  time: string;
  retentionCount: number;
  nextLabel: string | null;
};

export type ScheduledBackupRun = {
  id: string;
  slotKey: string;
  status: "ok" | "failed" | "running" | "purged";
  byteSize: number | null;
  errorMessage: string | null;
};

const saveInitial: ScheduleActionState = {};
const previewInitial: BackupActionState = {};
const TIMES = backupTimeOptions();
const STATUS: Record<ScheduledBackupRun["status"], string> = {
  ok: "Réussie",
  failed: "Échec",
  running: "En cours",
  purged: "Ancienne copie retirée",
};

function slotLabel(slotKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(slotKey);
  if (!match) return slotKey;
  return formatBackupWhen(zonedToUtc(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5])));
}

export function ScheduledBackupPanel({
  organizationName,
  values,
  runs,
  unavailable = false,
}: {
  organizationName: string;
  values: ScheduledBackupValues;
  runs: ScheduledBackupRun[];
  unavailable?: boolean;
}) {
  const [saved, saveAction, savePending] = useActionState(saveBackupScheduleAction, saveInitial);
  const [previewState, previewAction, previewPending] = useActionState(previewScheduledBackupAction, previewInitial);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreScheduledBackupAction, previewInitial);
  return (
    <section className="space-y-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5" aria-labelledby="sauvegardes-automatiques">
      <div>
        <h2 id="sauvegardes-automatiques" className="text-base font-semibold">Sauvegardes automatiques</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Le même fichier ZIP que la sauvegarde manuelle, conservé pour votre entreprise. L’heure choisie, à Casablanca, est respectée à environ 30 minutes près. Aucun e-mail n’est envoyé.</p>
      </div>
      {unavailable ? <p className="text-sm text-[var(--muted)]">La programmation sera disponible après l’installation de la migration 146. La sauvegarde manuelle reste utilisable.</p> : (
        <form action={saveAction} className="space-y-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="enabled" value="oui" defaultChecked={values.enabled} className="mt-1" />
            <span>Activer les sauvegardes automatiques</span>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Fréquence</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {([["daily", "Quotidienne"], ["weekly", "Hebdomadaire"], ["monthly", "Mensuelle"]] as const).map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-2">
                  <input type="radio" name="frequency" value={value} defaultChecked={values.frequency === value} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Jours, pour une fréquence hebdomadaire</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => (
                <label key={day.value} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-sm">
                  <input type="checkbox" name="weekdays" value={day.value} defaultChecked={values.weekdays.includes(day.value)} />
                  {day.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium">Jour du mois, pour une fréquence mensuelle
            <select name="monthDay" defaultValue={values.monthDay} className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2">
              {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
            <span className="mt-1 block font-normal text-[var(--muted)]">Si le mois est plus court, par exemple en février, la sauvegarde part le dernier jour.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Heure de lancement, Casablanca
              <select name="time" defaultValue={values.time} className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Copies conservées
              <input name="retentionCount" type="number" min={3} max={30} defaultValue={values.retentionCount} className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2" />
              <span className="mt-1 block font-normal text-[var(--muted)]">De 3 à 30. Les plus anciennes sont retirées.</span>
            </label>
          </div>
          <p className="text-sm">Prochaine exécution prévue : {values.nextLabel ?? "aucune, tant que la programmation est désactivée."}</p>
          <button type="submit" disabled={savePending} className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[#2454D8] px-4 text-sm font-semibold text-white disabled:opacity-50">{savePending ? "Enregistrement…" : "Enregistrer la programmation"}</button>
          {saved.error ? <p className="text-sm text-red-700" role="alert">{saved.error}</p> : null}
          {saved.saved ? <p className="text-sm text-emerald-800" role="status">Programmation enregistrée.</p> : null}
        </form>
      )}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Historique</h3>
        {runs.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune sauvegarde automatique pour le moment.</p> : (
          <ul className="space-y-3">
            {runs.map((run) => (
              <li key={run.id} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <p className="text-sm font-medium">{slotLabel(run.slotKey)}</p>
                <p className="text-sm text-[var(--muted)]">{STATUS[run.status]} · {formatBackupSize(run.byteSize)}</p>
                {run.errorMessage ? <p className="text-sm text-red-700">{run.errorMessage}</p> : null}
                {run.status === "ok" ? (
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/exports/sauvegarde/historique/${run.id}`} className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] bg-[#2454D8] px-3 text-sm font-semibold text-white">Télécharger</a>
                    <form action={previewAction}>
                      <input type="hidden" name="runId" value={run.id} />
                      <Button type="submit" variant="secondary" disabled={previewPending}>Restaurer</Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {previewState.error ? <p className="text-sm text-red-700" role="alert">{previewState.error}</p> : null}
        {previewState.preview && previewState.runId ? (
          <form className="space-y-3">
            <input type="hidden" name="runId" value={previewState.runId} />
            <BackupPreviewView
              preview={previewState.preview}
              organizationName={organizationName}
              restoreAction={restoreAction}
              restorePending={restorePending}
              restoreError={restoreState.error}
              restored={restoreState.restored}
            />
          </form>
        ) : null}
      </div>
    </section>
  );
}
