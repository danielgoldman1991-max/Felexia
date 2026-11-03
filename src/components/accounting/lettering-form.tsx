"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AccountingActionResult } from "@/lib/accounting-types";

type Line = {
  id: string;
  account_code: string;
  account_label: string | null;
  debit: number;
  credit: number;
  label: string | null;
};

export function LetteringForm({
  action,
  lines,
}: {
  action: (state: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
  lines: Line[];
}) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  if (lines.length === 0) return <p className="text-sm text-[var(--muted)]">Aucune ligne ouverte sur 3421 ou 4411.</p>;
  return (
    <form action={formAction} className="space-y-4">
      <label className="grid max-w-xs gap-1 text-sm">
        Code de lettrage
        <input name="lettering_code" required maxLength={6} className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 uppercase" placeholder="A1" />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2" />
              <th>Compte</th>
              <th>Libellé</th>
              <th className="text-right">Débit</th>
              <th className="text-right">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t border-[var(--border)]">
                <td className="py-2"><input type="checkbox" name="line_ids" value={line.id} /></td>
                <td>{line.account_code}</td>
                <td>{line.label || line.account_label}</td>
                <td className="text-right">{Number(line.debit).toFixed(2)}</td>
                <td className="text-right">{Number(line.credit).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!state.success && state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Lettrage…" : "Lettrer la sélection"}</Button>
    </form>
  );
}
