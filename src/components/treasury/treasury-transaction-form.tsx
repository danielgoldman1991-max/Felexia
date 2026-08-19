"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TREASURY_TRANSACTION_TYPE_LABELS, type TreasuryAccountRecord } from "@/lib/treasury-types";
import { createManualTreasuryTransaction } from "@/lib/treasury-actions";

export function TreasuryTransactionForm({ accounts }: { accounts: TreasuryAccountRecord[] }) {
  const [state, formAction, pending] = useActionState(createManualTreasuryTransaction, { success: true });
  const [operationMode, setOperationMode] = useState<"movement" | "transfer">("movement");
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const idempotencyKeyRef = useRef<string | null>(null);
  const allowedManualTypes = new Set(["manual_in", "manual_out", "bank_fee", "adjustment", "other"]);

  function handleSubmit(formData: FormData) {
    idempotencyKeyRef.current ??= globalThis.crypto.randomUUID();
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Mouvement de trésorerie</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOperationMode("movement")} className={operationMode === "movement" ? "rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]" : "rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"}>Entrée ou sortie</button>
            <button type="button" onClick={() => setOperationMode("transfer")} className={operationMode === "transfer" ? "rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]" : "rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"}>Transfert entre comptes</button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="operation_mode" value={operationMode} />
          <label className="space-y-2 text-sm">
            <span className="font-medium">{operationMode === "transfer" ? "Compte source *" : "Compte trésorerie *"}</span>
            <Select name="treasury_account_id" required value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)}>
              <option value="">Selectionner</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </label>
          {operationMode === "transfer" ? <label className="space-y-2 text-sm">
            <span className="font-medium">Compte destination *</span>
            <Select name="destination_account_id" required defaultValue="">
              <option value="">Sélectionner</option>
              {accounts.filter((account) => account.id !== sourceAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </label> : <label className="space-y-2 text-sm">
            <span className="font-medium">Type</span>
            <Select name="transaction_type" defaultValue="manual_in">
              {Object.entries(TREASURY_TRANSACTION_TYPE_LABELS).filter(([value]) => allowedManualTypes.has(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>}
          {operationMode === "movement" ? <label className="space-y-2 text-sm">
            <span className="font-medium">Sens</span>
            <Select name="direction" defaultValue="in">
              <option value="in">Entree</option>
              <option value="out">Sortie</option>
            </Select>
          </label> : null}
          <label className="space-y-2 text-sm">
            <span className="font-medium">Montant *</span>
            <MoneyInput name="amount" min={0.01} required />
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
        <Button type="button" variant="secondary" asChild><Link href="/tresorerie/mouvements">Annuler</Link></Button>
        <Button disabled={pending}>{pending ? "Enregistrement..." : operationMode === "transfer" ? "Effectuer le transfert" : "Créer le mouvement"}</Button>
      </div>
    </form>
  );
}
