"use client";

import { useActionState } from "react";
import { saveFiscalSettingsAction } from "@/lib/accounting/fiscal-settings-actions";

export function FiscalSettingsForm({ settings }: { settings: { cnss_affiliation: string | null; vat_frequency: string; is_rate_percent: number | null; activity_code: string | null; filing_note: string | null } }) {
  const [state, action, pending] = useActionState(saveFiscalSettingsAction, { success: false });
  return (
    <form action={action} className="erp-form grid max-w-3xl gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6">
      <label className="space-y-1 text-sm">
        <span className="font-medium">Affiliation CNSS</span>
        <input name="cnss_affiliation" defaultValue={settings.cnss_affiliation ?? ""} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3" placeholder="Numéro d'affiliation, pas le mot de passe Damancom" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Périodicité TVA</span>
        <select name="vat_frequency" defaultValue={settings.vat_frequency} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3">
          <option value="monthly">Mensuelle</option>
          <option value="quarterly">Trimestrielle</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Taux d&apos;IS retenu par votre conseil (%)</span>
        <input name="is_rate_percent" type="number" min="0" max="40" step="0.001" defaultValue={settings.is_rate_percent ?? ""} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3" placeholder="Laisser vide si le taux n'est pas confirmé" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Code activité</span>
        <input name="activity_code" defaultValue={settings.activity_code ?? ""} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Note de dépôt</span>
        <textarea name="filing_note" rows={3} defaultValue={settings.filing_note ?? ""} className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2" placeholder="Portail utilisé, période, personne qui dépose. Felexia ne se connecte pas." />
      </label>
      <div className="erp-form-actions">
        <button type="submit" disabled={pending} className="h-11 justify-self-end rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)]">Enregistrer</button>
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">Paramètres enregistrés. Les fichiers restent à téléverser par vos soins.</p> : null}
    </form>
  );
}
