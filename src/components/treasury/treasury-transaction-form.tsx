"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TREASURY_TRANSACTION_TYPE_LABELS, type TreasuryAccountRecord } from "@/lib/treasury-types";
import { createManualTreasuryTransaction } from "@/lib/treasury-actions";

export function TreasuryTransactionForm({ accounts }: { accounts: TreasuryAccountRecord[] }) {
  const [state, formAction, pending] = useActionState(createManualTreasuryTransaction, { success: true });
  return (
    <form action={formAction} className="space-y-5">
      <Card>
        <CardHeader><h2 className="font-semibold">Mouvement de tresorerie</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Compte tresorerie *</span>
            <Select name="treasury_account_id" required defaultValue={accounts[0]?.id ?? ""}>
              <option value="">Selectionner</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Type</span>
            <Select name="transaction_type" defaultValue="manual_in">
              {Object.entries(TREASURY_TRANSACTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Sens</span>
            <Select name="direction" defaultValue="in">
              <option value="in">Entree</option>
              <option value="out">Sortie</option>
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Montant *</span>
            <Input name="amount" type="number" min="0.01" step="0.01" required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Date operation</span>
            <Input name="transaction_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Date valeur</span>
            <Input name="value_date" type="date" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Libelle *</span>
            <Input name="label" required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Reference</span>
            <Input name="reference" />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <Textarea name="description" />
          </label>
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3">
        <Link href="/tresorerie/mouvements"><Button type="button" variant="secondary">Annuler</Button></Link>
        <Button disabled={pending}>Creer mouvement</Button>
      </div>
    </form>
  );
}
