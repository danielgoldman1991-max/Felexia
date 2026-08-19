"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TreasuryAccountRecord, TreasuryActionResult } from "@/lib/treasury-types";
import { FORECAST_CATEGORIES } from "@/lib/treasury/treasury-forecast";

export type TreasuryForecastFormValue = {
  id?: string;
  direction?: "inflow" | "outflow";
  label?: string;
  forecast_date?: string;
  amount?: number;
  probability?: number;
  status?: string;
  category?: string | null;
  treasury_account_id?: string | null;
  notes?: string | null;
};

type Props = {
  accounts: TreasuryAccountRecord[];
  item?: TreasuryForecastFormValue | null;
  action: (state: TreasuryActionResult, formData: FormData) => Promise<TreasuryActionResult>;
};

export function TreasuryForecastForm({ accounts, item, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  const [direction, setDirection] = useState<"inflow" | "outflow">(item?.direction ?? "inflow");

  const categories = FORECAST_CATEGORIES[direction];

  return (
    <form action={formAction} className="space-y-5">
      {item?.id ? <input type="hidden" name="id" value={item.id} /> : null}
      <Card>
        <CardHeader><h2 className="font-semibold">Prevision manuelle</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Type *</span>
            <Select name="direction" value={direction} onChange={(e) => setDirection(e.target.value === "outflow" ? "outflow" : "inflow")}>
              <option value="inflow">Entree prevue (encaissement)</option>
              <option value="outflow">Sortie prevue (decaissement)</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Libelle *</span>
            <Input name="label" defaultValue={item?.label ?? ""} placeholder="Ex : Loyer local, Apport du gerant..." required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Date prevue *</span>
            <Input name="forecast_date" type="date" defaultValue={item?.forecast_date ?? ""} required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Montant (MAD) *</span>
            <MoneyInput name="amount" min={0.01} defaultValue={item?.amount ?? ""} required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Probabilite (%)</span>
            <Input name="probability" type="number" step="1" min="0" max="100" defaultValue={item?.probability ?? 100} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Categorie</span>
            <Select name="category" defaultValue={item?.category ?? ""}>
              <option value="">Sans categorie</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Compte concerne (optionnel)</span>
            <Select name="treasury_account_id" defaultValue={item?.treasury_account_id ?? ""}>
              <option value="">Non affecte</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </label>
          {item?.id ? (
            <label className="space-y-2 text-sm">
              <span className="font-medium">Statut</span>
              <Select name="status" defaultValue={item?.status ?? "planned"}>
                <option value="planned">Planifiee</option>
                <option value="confirmed">Confirmee</option>
                <option value="realized">Realisee</option>
                <option value="cancelled">Annulee</option>
                <option value="ignored">Ignoree</option>
              </Select>
            </label>
          ) : null}
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Notes</span>
            <Textarea name="notes" defaultValue={item?.notes ?? ""} placeholder="Commentaire interne..." />
          </label>
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href="/tresorerie/previsions">Annuler</Link></Button>
        <Button disabled={pending}>{item?.id ? "Enregistrer" : "Creer la prevision"}</Button>
      </div>
    </form>
  );
}
