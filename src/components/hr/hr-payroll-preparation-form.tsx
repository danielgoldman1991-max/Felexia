"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { prepareReferencePayrollAction, setPayrollPeriodStatusAction } from "@/lib/hr/payroll-batch-actions";
import { Button } from "@/components/ui/button";

type PrepareState = { success: boolean; error?: string; count?: number; skipped?: Array<{ name: string; reason: string }> };

export function HrPayrollPreparationForm({ periodId, updatedAt, status = "draft" }: { periodId: string; updatedAt: string; status?: string }) {
  const router = useRouter();
  const empty: PrepareState = { success: false, error: undefined };
  const [state, action, pending] = useActionState(prepareReferencePayrollAction.bind(null, periodId), empty);
  const [life, lifeAction, lifePending] = useActionState(async (_previous: { success: boolean; error?: string }, formData: FormData) => {
    const next = formData.get("next") === "paid" ? "paid" : "validated";
    return setPayrollPeriodStatusAction(periodId, next);
  }, empty);
  useEffect(() => {
    if (state.success || life.success) router.refresh();
  }, [life.success, router, state.success]);
  const canValidate = status === "calculated" || (status === "draft" && state.success);
  return (
    <div className="space-y-4">
      {status === "draft" || status === "calculated" ? <form action={action} className="space-y-4">
        <input type="hidden" name="expected_updated_at" value={updatedAt} />
        <p className="text-sm text-[var(--muted)]">Le calcul reprend le référentiel 2026 (CNSS, AMO, ancienneté, frais professionnels, IR et charges de famille), les avances du mois et les échéances de prêt.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="ack_base_only" value="yes" required className="mt-1" /><span>Je lance le calcul avec le référentiel 2026. Les montants restent à valider avant paiement.</span></label>
        {state.error ? <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p> : null}
        {state.success ? <p role="status" className="text-sm text-[var(--success)]">Les bulletins et les totaux ont été enregistrés ensemble.{typeof state.count === "number" ? ` ${state.count} bulletin${state.count > 1 ? "s" : ""}.` : ""}</p> : null}
        {state.skipped && state.skipped.length > 0 ? (
          <ul className="space-y-1 text-sm text-amber-800">
            {state.skipped.map((item) => <li key={`${item.name}-${item.reason}`}>{item.name} : {item.reason}</li>)}
          </ul>
        ) : null}
        <Button type="submit" disabled={pending}>{pending ? "Calcul…" : "Préparer les bulletins"}</Button>
      </form> : null}
      {status !== "paid" && (canValidate || status === "validated") ? (
        <form action={lifeAction} className="flex flex-wrap gap-2">
          {canValidate ? <Button name="next" value="validated" variant="secondary" disabled={lifePending}>Valider la période</Button> : null}
          {status === "validated" ? <Button name="next" value="paid" disabled={lifePending}>Payer et comptabiliser</Button> : null}
          {life.error ? <p role="alert" className="w-full text-sm text-[var(--danger)]">{life.error}</p> : null}
          {life.success ? <p role="status" className="w-full text-sm text-[var(--success)]">La période a été mise à jour. L’écriture de paie est passée à la validation.</p> : null}
        </form>
      ) : null}
    </div>
  );
}
