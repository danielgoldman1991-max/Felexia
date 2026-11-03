"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { StockActionResult, StockProductOption } from "@/lib/stock-types";
import type { WarehouseOption } from "@/lib/stock-types";

export function StockTransferForm({
  action,
  products,
  locations,
}: {
  action: (state: StockActionResult, formData: FormData) => Promise<StockActionResult>;
  products: StockProductOption[];
  locations: WarehouseOption[];
}) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <label className="grid gap-1 text-sm">
        Article
        <select name="product_id" required className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="">Choisir</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Depuis
        <select name="from_warehouse_id" required className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="">Choisir</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Vers
        <select name="to_warehouse_id" required className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="">Choisir</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Quantité
        <input name="quantity" type="number" min="0.001" step="0.001" required className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" />
      </label>
      <label className="grid gap-1 text-sm">
        Note
        <input name="notes" className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" />
      </label>
      {!state.success && state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Transfert…" : "Transférer"}</Button>
    </form>
  );
}
