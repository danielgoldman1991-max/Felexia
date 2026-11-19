"use client";

import { useActionState } from "react";
import { saveVatFilingAction } from "@/lib/tax/vat-filing-actions";

export function VatFilingForm({ frequency, regime, canWrite }: { frequency: "monthly" | "quarterly"; regime: string; canWrite: boolean }) {
  const [state, action, pending] = useActionState(saveVatFilingAction, { success: false });
  if (!canWrite) return <p className="text-sm text-[var(--muted)]">Votre accès permet de consulter la périodicité TVA.</p>;
  return (
    <form action={action} className="erp-form grid max-w-xl gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6">
      <label className="space-y-1 text-sm">
        <span className="font-medium">Périodicité TVA</span>
        <select name="vat_frequency" defaultValue={frequency} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3">
          <option value="monthly">Mensuelle</option>
          <option value="quarterly">Trimestrielle</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Régime TVA</span>
        <select name="vat_regime" defaultValue={regime} className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3">
          <option value="unspecified">Non précisé (déduction à l&apos;encaissement)</option>
          <option value="encaissement">Encaissement</option>
          <option value="debit">Débit</option>
          <option value="mixed">Mixte</option>
        </select>
      </label>
      <p className="text-xs text-[var(--muted)]">Ce réglage sert aux nouvelles déclarations et au relevé SIMPL-TVA. Il ne modifie pas le dépôt CNSS, l&apos;IS ni les fichiers préparatoires.</p>
      <button type="submit" disabled={pending} className="h-11 justify-self-start rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)]">Enregistrer</button>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">Périodicité et régime enregistrés.</p> : null}
    </form>
  );
}
