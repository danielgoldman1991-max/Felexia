"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

export function PayslipStatusButton({
  action,
  id,
  label,
}: {
  action: (previous: { error?: string; success?: boolean }, formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  id: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, { success: false });
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : label}</Button>
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
