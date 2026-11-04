"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePriceListAction } from "@/lib/sales/commercial-terms-actions";

type Line = { description: string; unit_price: string; product_id: string };
type Customer = { id: string; name: string };
type Product = { id: string; name: string };

export function PriceListForm({
  customers,
  products,
  initial,
}: {
  customers: Customer[];
  products: Product[];
  initial?: { id: string; name: string; customerId: string | null; discount: number; active: boolean; lines: Line[] };
}) {
  const [state, action, pending] = useActionState(savePriceListAction, { success: false, error: undefined });
  const [lines, setLines] = useState<Line[]>(initial?.lines.length ? initial.lines : [{ description: "", unit_price: "", product_id: "" }]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <input type="hidden" name="lines" value={JSON.stringify(lines.map((line) => ({ ...line, unit_price: Number(line.unit_price || 0) })))} />
      <label className="block text-sm">Nom de la liste
        <Input name="name" required defaultValue={initial?.name ?? ""} className="mt-1" />
      </label>
      <label className="block text-sm">Client
        <select name="customer_id" defaultValue={initial?.customerId ?? ""} className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="">Tous les clients (liste non rattachée)</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </label>
      <label className="block text-sm">Remise générale (%)
        <Input name="discount_percent" type="number" min="0" max="100" step="0.01" defaultValue={String(initial?.discount ?? 0)} className="mt-1" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={initial?.active ?? true} /> Liste active, appliquée aux devis et factures</label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Prix par article</p>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_8rem_auto]">
            <select value={line.product_id} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, product_id: event.target.value } : item))} className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
              <option value="">Article libre</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <Input value={line.description} placeholder="Description" onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
            <Input value={line.unit_price} placeholder="Prix HT" inputMode="decimal" onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unit_price: event.target.value } : item))} />
            <Button type="button" variant="ghost" onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Retirer</Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setLines((current) => [...current, { description: "", unit_price: "", product_id: "" }])}>Ajouter un prix</Button>
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la liste"}</Button>
        <Button type="button" variant="secondary" asChild><Link href="/vente/prix">Annuler</Link></Button>
      </div>
    </form>
  );
}
