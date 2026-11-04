"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveInventoryCountAction, validateInventorySessionAction } from "@/lib/stock/inventory-actions";

type Line = { id: string; name: string; theoretical: number; counted: number };

export function InventoryCountForm({ countId, lines, locked }: { countId: string; lines: Line[]; locked: boolean }) {
  const [rows, setRows] = useState(lines);
  const [saved, save, saving] = useActionState(saveInventoryCountAction, { success: false, error: undefined });
  const [validated, validate, validating] = useActionState(validateInventorySessionAction, { success: false, error: undefined });
  const payload = JSON.stringify(rows.map((row) => ({ id: row.id, theoretical: row.theoretical, counted: Number(row.counted) })));
  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[var(--muted)]"><th>Article</th><th>Théorique</th><th>Compté</th><th>Écart</th></tr></thead>
        <tbody>
          {rows.map((row, index) => {
            const variance = Math.round((Number(row.counted) - row.theoretical) * 1000) / 1000;
            return (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="py-2">{row.name}</td>
                <td>{row.theoretical.toLocaleString("fr-MA")}</td>
                <td>
                  <input
                    disabled={locked}
                    type="number"
                    step="0.001"
                    value={row.counted}
                    onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, counted: Number(event.target.value) } : item))}
                    className="h-9 w-28 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2"
                  />
                </td>
                <td>{variance.toLocaleString("fr-MA")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucun stock théorique sur cet emplacement. La validation n’écrira pas de mouvement.</p> : null}
      {saved.error || validated.error ? <p className="text-sm text-red-700">{saved.error || validated.error}</p> : null}
      {saved.success ? <p className="text-sm">Comptage enregistré.</p> : null}
      {locked ? <p className="text-sm">Session validée. Les écarts ont généré les ajustements et les quantités sont figées.</p> : (
        <div className="flex flex-wrap gap-2">
          <form action={save}><input type="hidden" name="count_id" value={countId} /><input type="hidden" name="lines" value={payload} /><Button type="submit" variant="secondary" disabled={saving}>Enregistrer le comptage</Button></form>
          <form action={validate}><input type="hidden" name="count_id" value={countId} /><input type="hidden" name="lines" value={payload} /><Button type="submit" disabled={validating}>Valider et ajuster le stock</Button></form>
        </div>
      )}
    </div>
  );
}
