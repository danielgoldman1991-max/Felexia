"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createPurchaseRequest } from "@/lib/purchases/procurement-actions";

export default function NewPurchaseRequestPage() {
  const [state, action, pending] = useActionState(createPurchaseRequest, { success: true });
  return (
    <ModulePage>
      <PageHeader title="Nouvelle demande d'achat" description="Décrivez le besoin. La commande fournisseur reste une étape séparée." />
      <form action={action} className="max-w-3xl space-y-4">
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
    </ModulePage>
  );
}
