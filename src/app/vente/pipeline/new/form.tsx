"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PIPELINE_STAGES } from "@/lib/sales/pipeline";

export function OpportunityForm({ action }: { action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid max-w-xl gap-3">
      <label className="text-sm">Titre<input name="title" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Client<input name="customer_name" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Étape
        <select name="stage" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2">
          {PIPELINE_STAGES.map((stage) => <option key={stage.code} value={stage.code}>{stage.label}</option>)}
        </select>
      </label>
      <label className="text-sm">Montant MAD<input name="amount" type="number" min="0" step="0.01" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Échéance prévue<input name="expected_on" type="date" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button variant="secondary" asChild><Link href="/vente/pipeline">Annuler</Link></Button>
      </div>
    </form>
  );
}
