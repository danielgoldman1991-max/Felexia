"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acquiredLeaveDays } from "@/lib/hr/leave-balance";

export function LeaveBalanceForm({ action }: { action: (state: { error?: string; success?: boolean }, formData: FormData) => Promise<{ error?: string; success?: boolean }> }) {
  const [state, formAction, pending] = useActionState(action, { success: false });
  return (
    <>
      <p className="text-sm text-[var(--muted)]">Une année complète ouvre {acquiredLeaveDays(12)} jours. Le solde enregistré déduit les demandes approuvées de l’année.</p>
      <form action={formAction} className="mt-4">
        <Button type="submit" disabled={pending}>{pending ? "Calcul…" : "Recalculer et enregistrer les soldes"}</Button>
      </form>
      {state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">Soldes enregistrés pour l’année en cours.</p> : null}
    </>
  );
}
