"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createPurchaseRfq } from "@/lib/purchases/procurement-actions";

export default function NewPurchaseRfqPage() {
  const [state, action, pending] = useActionState(createPurchaseRfq, { success: true });
  return (
    <ModulePage>
      <PageHeader title="Nouvelle consultation" description="Saisissez au moins deux offres. Le classement est calculé à l'enregistrement." />
      <form action={action} className="max-w-4xl space-y-4">
        <Card>
          <CardHeader><h2 className="font-semibold">Objet</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="text-sm md:col-span-2">Titre<input name="title" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
            <label className="text-sm">Date limite<input name="due_date" type="date" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
            <label className="text-sm">Notes<input name="notes" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          </CardContent>
        </Card>
        {[1, 2, 3].map((index) => (
          <Card key={index}>
            <CardHeader><h2 className="font-semibold">Offre {index}</h2></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <label className="text-sm md:col-span-2">Fournisseur<input name={`supplier_${index}`} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
              <label className="text-sm">Total HT<input name={`ht_${index}`} type="number" min="0" step="0.01" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
              <label className="text-sm">Total TTC<input name={`ttc_${index}`} type="number" min="0" step="0.01" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
              <label className="text-sm">Délai (jours)<input name={`lead_${index}`} type="number" min="0" step="1" className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
            </CardContent>
          </Card>
        ))}
        {!state.success && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Comparaison…" : "Comparer et enregistrer"}</Button>
          <Button type="button" variant="secondary" asChild><Link href="/achats/consultations">Annuler</Link></Button>
        </div>
      </form>
    </ModulePage>
  );
}
