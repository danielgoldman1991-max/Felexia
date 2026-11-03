"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AccountingActionResult } from "@/lib/accounting-types";

export function OpenFiscalYearForm({
  action,
}: {
  action: (state: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction} className="mb-6 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">
        Année civile
        <input name="year" type="number" min={2000} max={2100} defaultValue={new Date().getFullYear()} required className="h-10 w-32 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" />
      </label>
      <Button type="submit" disabled={pending}>{pending ? "Ouverture…" : "Ouvrir l'exercice"}</Button>
      {!state.success && state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success && state.data ? <p className="text-sm text-emerald-700">Exercice ouvert.</p> : null}
    </form>
  );
}
