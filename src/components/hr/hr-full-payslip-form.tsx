"use client";

import { useActionState } from "react";
import { prepareFullPayslipFormAction } from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";

export function HrFullPayslipForm({ periodId, employees }: { periodId: string; employees: { id: string; full_name: string }[] }) {
  const [state, action, pending] = useActionState(prepareFullPayslipFormAction.bind(null, periodId), { success: false });
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <label className="text-sm md:col-span-3">Salarié
        <select name="employee_id" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2">
          <option value="">Choisir</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
        </select>
      </label>
      <label className="text-sm">Primes<input name="bonuses" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Heures supplémentaires<input name="overtime_amount" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Indemnités<input name="indemnities" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Absence<input name="absence_deduction" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Avance<input name="advance_deduction" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      <label className="text-sm">Personnes à charge<input name="dependents" type="number" min="0" max="6" step="1" defaultValue="0" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
      {state.error ? <p className="text-sm text-red-600 md:col-span-3">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 md:col-span-3">Bulletin 2026 enregistré. L’ancienneté, la CNSS, l’AMO et l’IR sont calculés. Le statut reste « calculé » : la validation finale est encore bloquée par la garde préparatoire.</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Calcul…" : "Enregistrer le bulletin complet"}</Button>
    </form>
  );
}
