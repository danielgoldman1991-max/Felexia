"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ProductActionResult } from "@/lib/product-actions";
import type { TaxRate } from "@/lib/product-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  mode: "create" | "edit";
  taxRate?: TaxRate;
  action: (state: ProductActionResult, formData: FormData) => Promise<ProductActionResult>;
};

const initialState: ProductActionResult = { success: true };

export function TaxRateForm({ mode, taxRate, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {taxRate ? <input type="hidden" name="id" value={taxRate.id} /> : null}

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Nom *</span>
            <Input name="name" defaultValue={taxRate?.name ?? ""} required />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Taux (%) *</span>
            <Input name="rate" type="number" min="0" max="100" step="0.01" defaultValue={taxRate?.rate ?? ""} required />
          </label>
          <label className="flex items-center gap-2 space-y-0 text-sm">
            <input name="is_default" type="checkbox" defaultChecked={taxRate?.is_default ?? false} />
            <span className="font-medium text-[var(--muted)]">TVA par defaut</span>
          </label>
          {taxRate ? (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-[var(--muted)]">Statut</span>
              <Select name="status" defaultValue={taxRate?.status ?? "active"}>
                <option value="active">Actif</option>
                <option value="archived">Archive</option>
              </Select>
            </label>
          ) : null}
          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium text-[var(--muted)]">Description</span>
            <Textarea name="description" defaultValue={taxRate?.description ?? ""} />
          </label>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href="/articles/tva">Annuler</Link></Button>
        <Button disabled={pending}>{mode === "create" ? "Creer le taux" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
