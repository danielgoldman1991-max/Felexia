"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createVatDeclarationAction } from "@/lib/tax/vat-declaration-actions";

function getDefaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function NewVatDeclarationForm() {
  const defaultPeriod = getDefaultPeriod();
  const [state, formAction, pending] = useActionState(createVatDeclarationAction, { success: false });

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="periodStart">Date début *</Label>
          <Input id="periodStart" name="periodStart" type="date" required defaultValue={defaultPeriod.start} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">Date fin *</Label>
          <Input id="periodEnd" name="periodEnd" type="date" required defaultValue={defaultPeriod.end} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="frequency">Fréquence</Label>
          <select
            id="frequency"
            name="frequency"
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            defaultValue="monthly"
          >
            <option value="monthly">Mensuelle</option>
            <option value="quarterly">Trimestrielle</option>
            <option value="annual_control">Contrôle annuel</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatRegime">Régime TVA</Label>
          <select
            id="vatRegime"
            name="vatRegime"
            className="h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            defaultValue="unspecified"
          >
            <option value="unspecified">Non spécifié</option>
            <option value="debit">Débit</option>
            <option value="encaissement">Encaissement</option>
            <option value="mixed">Mixte</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priorCredit">Crédit TVA antérieur (MAD)</Label>
        <Input id="priorCredit" name="priorCredit" type="number" min="0" step="0.01" defaultValue="0" />
        <p className="text-xs text-[var(--muted)]">Montant du crédit TVA à reporter depuis la déclaration précédente.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes internes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          placeholder="Notes optionnelles..."
        />
      </div>

      {!state.success && state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" asChild><Link href="/comptabilite/tva/declarations">Annuler</Link></Button>
        <Button type="submit" disabled={pending}>
          <Calculator className="h-4 w-4" />
          {pending ? "Calcul en cours..." : "Créer la déclaration"}
        </Button>
      </div>
    </form>
  );
}
