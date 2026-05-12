"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TREASURY_ACCOUNT_TYPE_LABELS, type TreasuryAccountRecord, type TreasuryActionResult } from "@/lib/treasury-types";

type Props = {
  account?: TreasuryAccountRecord | null;
  action: (state: TreasuryActionResult, formData: FormData) => Promise<TreasuryActionResult>;
};

export function TreasuryAccountForm({ account, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { success: true });

  return (
    <form action={formAction} className="space-y-5">
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <Card>
        <CardHeader><h2 className="font-semibold">Compte de tresorerie</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Nom du compte *</span>
            <Input name="name" defaultValue={account?.name ?? ""} required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Code</span>
            <Input name="code" defaultValue={account?.code ?? ""} placeholder="BANK-MAIN" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Type</span>
            <Select name="account_type" defaultValue={account?.account_type ?? "bank"}>
              {Object.entries(TREASURY_ACCOUNT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Devise</span>
            <Input name="currency" defaultValue={account?.currency ?? "MAD"} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Banque</span>
            <Input name="bank_name" defaultValue={account?.bank_name ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Agence</span>
            <Input name="agency_name" defaultValue={account?.agency_name ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">RIB</span>
            <Input name="rib" defaultValue={account?.rib ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">IBAN</span>
            <Input name="iban" defaultValue={account?.iban ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">SWIFT</span>
            <Input name="swift" defaultValue={account?.swift ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Numero compte</span>
            <Input name="account_number" defaultValue={account?.account_number ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Solde initial</span>
            <Input name="opening_balance" type="number" step="0.01" min="0" defaultValue={account?.opening_balance ?? 0} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Date solde initial</span>
            <Input name="opening_balance_date" type="date" defaultValue={account?.opening_balance_date ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Statut</span>
            <Select name="status" defaultValue={account?.status ?? "active"}>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="archived">Archive</option>
            </Select>
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input type="checkbox" name="is_default" defaultChecked={Boolean(account?.is_default)} />
            <span className="font-medium">Compte par defaut</span>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Notes</span>
            <Textarea name="notes" defaultValue={account?.notes ?? ""} />
          </label>
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3">
        <Link href="/tresorerie/comptes"><Button type="button" variant="secondary">Annuler</Button></Link>
        <Button disabled={pending}>{account ? "Enregistrer" : "Creer compte"}</Button>
      </div>
    </form>
  );
}
