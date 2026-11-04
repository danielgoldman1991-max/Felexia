"use client";

import { useActionState } from "react";
import { toggleHrCheckAction } from "@/lib/hr/contract-actions";

export function HrCheckToggle({ employeeId, kind, itemKey, label, done }: { employeeId: string; kind: "onboarding" | "offboarding"; itemKey: string; label: string; done: boolean }) {
  const [state, action, pending] = useActionState(toggleHrCheckAction, { success: false });
  return (
    <form action={action} className="premium-card flex items-center justify-between gap-3 p-4">
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="item_key" value={itemKey} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <span className="text-sm font-medium">{label}</span>
      <button type="submit" disabled={pending} className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm">
        {done ? "Fait · annuler" : "Marquer fait"}
      </button>
      {state.error ? <span className="sr-only">{state.error}</span> : null}
      {state.error ? <p className="basis-full text-sm text-red-700">{state.error}</p> : null}
    </form>
  );
}
