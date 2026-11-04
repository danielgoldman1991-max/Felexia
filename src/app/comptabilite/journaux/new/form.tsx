"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAccountingJournal } from "@/lib/accounting-actions";
import type { AccountingActionResult } from "@/lib/accounting-types";

const TYPES = [
  { value: "sales", label: "Ventes" },
  { value: "purchases", label: "Achats" },
  { value: "bank", label: "Banque" },
  { value: "cash", label: "Caisse" },
  { value: "od", label: "Opérations diverses" },
] as const;

export function JournalCreateForm({ accounts }: { accounts: { id: string; name: string; accountType: string }[] }) {
  const [state, action, pending] = useActionState(createAccountingJournal, { success: true } as AccountingActionResult);
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <label className="text-sm">Code
        <Input name="code" required maxLength={8} placeholder="BQ2" className="mt-1 uppercase" />
      </label>
      <label className="text-sm">Nom
        <Input name="name" required placeholder="Banque secondaire" className="mt-1" />
      </label>
      <label className="text-sm">Type
        <select name="type" required defaultValue="bank" className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </label>
      <label className="text-sm">Compte de trésorerie (banque ou caisse)
        <select name="treasury_account_id" defaultValue="" className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="">Aucun</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Description
        <Input name="description" className="mt-1" />
      </label>
      {!state.success && state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer le journal"}</Button>
        <Button type="button" variant="secondary" asChild><Link href="/comptabilite/journaux">Annuler</Link></Button>
      </div>
    </form>
  );
}
