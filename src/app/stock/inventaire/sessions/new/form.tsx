"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createInventorySessionAction } from "@/lib/stock/inventory-actions";

export function InventorySessionForm({ warehouses }: { warehouses: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createInventorySessionAction, { success: false, error: undefined });
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <label className="text-sm">Emplacement
        <select name="warehouse_id" required className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="">Choisir</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Date de comptage<Input name="counted_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1" /></label>
      <label className="text-sm">Notes<Input name="notes" className="mt-1" /></label>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Ouvrir la feuille"}</Button>
        <Button type="button" variant="secondary" asChild><Link href="/stock/inventaire/sessions">Annuler</Link></Button>
      </div>
    </form>
  );
}
