"use client";

import { useActionState } from "react";
import { prepareHrPayrollPeriodFormAction } from "@/lib/hr/actions";
import { Button } from "@/components/ui/button";

export function HrPayrollPreparationForm({ periodId, updatedAt }: { periodId: string; updatedAt: string }) {
  const [state, action, pending] = useActionState(prepareHrPayrollPeriodFormAction.bind(null, periodId), {});
  return <form action={action} className="space-y-4">
    <input type="hidden" name="expected_updated_at" value={updatedAt} />
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="ack_base_only" value="yes" required className="mt-1" /><span>Je prépare uniquement le salaire de base, sans variables ni validation/paiement final.</span></label>
    {state.error ? <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p> : null}
    {state.success ? <p role="status" className="text-sm text-[var(--success)]">La préparation et les totaux ont été enregistrés ensemble. Les variables et la paie finale restent exclues.</p> : null}
    <Button type="submit" disabled={pending}>{pending ? "Préparation…" : "Préparer les bulletins de base"}</Button>
  </form>;
}
