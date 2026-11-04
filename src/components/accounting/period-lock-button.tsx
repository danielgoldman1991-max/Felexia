"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setAccountingPeriodLock } from "@/lib/accounting-actions";
import type { AccountingActionResult } from "@/lib/accounting-types";

export function PeriodLockButton({ periodId, locked, label }: { periodId: string; locked: boolean; label: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setAccountingPeriodLock, { success: true } as AccountingActionResult);
  const message = !pending && state.success ? (state.data as { message?: string } | undefined)?.message : undefined;
  const lockedNow = message ? message.includes("verrouillée") : locked;
  const toasted = useRef<string | null>(null);
  useEffect(() => {
    if (!message || toasted.current === message) return;
    toasted.current = message;
    toast.success(message);
    router.refresh();
  }, [message, router]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-[var(--muted)]">{label} · {lockedNow ? "Verrouillée" : "Ouverte"}</p>
      <form action={action}>
        <input type="hidden" name="period_id" value={periodId} />
        <input type="hidden" name="locked" value={lockedNow ? "0" : "1"} />
        <Button type="submit" variant={lockedNow ? "secondary" : "primary"} disabled={pending}>{pending ? "Enregistrement…" : lockedNow ? "Déverrouiller" : "Verrouiller"}</Button>
        {!state.success && state.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
      </form>
    </div>
  );
}
