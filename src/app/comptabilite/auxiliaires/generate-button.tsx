"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AccountingActionResult } from "@/lib/accounting-types";

export function GenerateAuxiliariesButton({ action }: { action: (prev: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult> }) {
  const [state, formAction, pending] = useActionState(action, { success: true } as AccountingActionResult);
  const message = (state.data as { message?: string } | undefined)?.message;
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button type="submit" disabled={pending}>{pending ? "Génération…" : "Générer"}</Button>
      {!state.success && state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      {state.success && message ? <span className="text-xs text-emerald-700">{message}</span> : null}
    </form>
  );
}
