"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { importBankStatement } from "@/lib/treasury-actions";
import type { TreasuryAccountRecord } from "@/lib/treasury-types";

export function BankStatementImportForm({ accounts }: { accounts: TreasuryAccountRecord[] }) {
  const [state, formAction, pending] = useActionState(importBankStatement, { success: true });
  return (
    <form action={formAction} className="space-y-5">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Import releve bancaire</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Format CSV standard : date,value_date,label,reference,debit,credit,balance</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Compte bancaire *</span>
            <Select name="treasury_account_id" required defaultValue={accounts[0]?.id ?? ""}>
              <option value="">Selectionner</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Format</span>
            <Select name="file_type" defaultValue="csv"><option value="csv">CSV</option></Select>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Fichier CSV *</span>
            <Input name="file" type="file" accept=".csv,text/csv" required />
          </label>
        </CardContent>
      </Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3">
        <Link href="/tresorerie/releves"><Button type="button" variant="secondary">Annuler</Button></Link>
        <Button disabled={pending}>Importer le releve</Button>
      </div>
    </form>
  );
}
