"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
type ProcurementResult = { success: boolean; error?: string };

export function PurchaseRequestForm({ action }: { action: (state: ProcurementResult, formData: FormData) => Promise<ProcurementResult> }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction} className="max-w-3xl space-y-4">
      <Card>
        <CardHeader><h2 className="font-semibold">Besoin</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">Objet<input name="title" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="text-sm md:col-span-2">Description<input name="description" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="text-sm">Quantité<input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="text-sm">Unité<input name="unit_name" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="text-sm">Prix estimé HT<input name="estimated_unit_price_ht" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="text-sm">Date de besoin<input name="needed_on" type="date" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="text-sm md:col-span-2">Notes<textarea name="notes" rows={3} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la demande"}</Button>
        <Button type="button" variant="secondary" asChild><Link href="/achats/demandes">Annuler</Link></Button>
      </div>
    </form>
  );
}
