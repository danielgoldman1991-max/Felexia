"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setAccountingPeriodLock } from "@/lib/accounting-actions";
import type { AccountingActionResult } from "@/lib/accounting-types";

export function PeriodLockButton({ periodId, locked }: { periodId: string; locked: boolean }) {
  const [state, action, pending] = useActionState(setAccountingPeriodLock, { success: true } as AccountingActionResult);
  const toasted = useRef(false);
  useEffect(() => {
    if (pending) toasted.current = false;
    const message = (state.data as { message?: string } | undefined)?.message;
    if (!pending && state.success && message && !toasted.current) {
      toasted.current = true;
      toast.success(message);
    }
  }, [pending, state]);
  return (
    <form action={action}>
      <input type="hidden" name="period_id" value={periodId} />
      <input type="hidden" name="locked" value={locked ? "0" : "1"} />
      <Button type="submit" variant={locked ? "secondary" : "primary"} disabled={pending}>{pending ? "Enregistrement…" : locked ? "Déverrouiller" : "Verrouiller"}</Button>
      {!state.success && state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
