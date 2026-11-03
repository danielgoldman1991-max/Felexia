"use client";

import { useActionState } from "react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { refreshLeaveBalancesAction } from "@/lib/hr/actions";
import { acquiredLeaveDays } from "@/lib/hr/leave-balance";

export default function LeaveBalancesPage() {
  const [state, action, pending] = useActionState(refreshLeaveBalancesAction, { success: false });
  return (
    <ModulePage>
      <PageHeader title="Soldes de congés" description="1,5 jour ouvrable par mois de service, soit 18 jours par année complète." />
      <p className="text-sm text-[var(--muted)]">Une année complète ouvre {acquiredLeaveDays(12)} jours. Le solde enregistré déduit les demandes approuvées de l’année.</p>
      <form action={action} className="mt-4">
        <Button type="submit" disabled={pending}>{pending ? "Calcul…" : "Recalculer et enregistrer les soldes"}</Button>
      </form>
      {state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="mt-3 text-sm text-emerald-700">Soldes enregistrés pour l’année en cours.</p> : null}
    </ModulePage>
  );
}
