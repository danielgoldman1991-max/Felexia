"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MOROCCAN_BANKS } from "@/lib/treasury/moroccan-banks";

type ColumnMapping = {
  date: string;
  valueDate: string | null;
  label: string;
  reference: string | null;
  debit: string | null;
  credit: string | null;
  amount: string | null;
  balance: string | null;
  delimiter?: string;
};
import { importBankStatement } from "@/lib/treasury-actions";
import type { TreasuryAccountRecord } from "@/lib/treasury-types";

const ROLES = [
  ["date", "Date d'opération"],
  ["valueDate", "Date de valeur"],
  ["label", "Libellé"],
  ["reference", "Référence"],
  ["debit", "Débit"],
  ["credit", "Crédit"],
  ["amount", "Montant signé"],
  ["balance", "Solde"],
] as const;

type Feedback = { needsMapping?: boolean; headers?: string[]; sample?: string[][]; suggested?: ColumnMapping | null; bankCode?: string | null };

export function BankStatementImportForm({ accounts }: { accounts: TreasuryAccountRecord[] }) {
  const [state, formAction, pending] = useActionState(importBankStatement, { success: true });
  const feedback = (state.data ?? null) as Feedback | null;
  const headers = feedback?.headers ?? [];
  const [roles, setRoles] = useState<Record<string, string>>({});
  const mapping = useMemo(() => {
    const initial = feedback?.suggested;
    const value = (role: string) => roles[role] ?? (initial?.[role as keyof ColumnMapping] as string | null) ?? "";
    if (!value("date") || !value("label")) return "";
    return JSON.stringify({
      date: value("date"),
      valueDate: value("valueDate") || null,
      label: value("label"),
      reference: value("reference") || null,
      debit: value("debit") || null,
      credit: value("credit") || null,
      amount: value("amount") || null,
      direction: null,
      balance: value("balance") || null,
      delimiter: initial?.delimiter || ";",
      bankCode: feedback?.bankCode ?? null,
    });
  }, [feedback, roles]);

  return (
    <form action={formAction} className="erp-form space-y-5">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Import de relevé</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">OFX, CSV ou Excel des banques marocaines. Les lignes déjà importées sont ignorées.</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Compte bancaire *</span>
            <Select name="treasury_account_id" required defaultValue={accounts[0]?.id ?? ""}>
              <option value="">Sélectionner</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Banque</span>
            <Select name="bank_code" defaultValue={feedback?.bankCode ?? ""}>
              <option value="">Reconnaître par les colonnes</option>
              {MOROCCAN_BANKS.map((bank) => <option key={bank.code} value={bank.code}>{bank.label}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Fichier *</span>
            <Input name="file" type="file" accept=".csv,.xlsx,.ofx,.qfx,text/csv" required />
          </label>
        </CardContent>
      </Card>
      {feedback?.needsMapping && headers.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Correspondance des colonnes</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Elle sera mémorisée pour ce compte. Resélectionnez le fichier avant de valider.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {ROLES.map(([role, label]) => (
              <label key={role} className="space-y-1 text-sm">
                <span className="font-medium">{label}</span>
                <Select value={roles[role] ?? (feedback.suggested?.[role as keyof ColumnMapping] as string | null) ?? ""} onChange={(event) => setRoles((current) => ({ ...current, [role]: event.target.value }))}>
                  <option value="">—</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </Select>
              </label>
            ))}
            <input type="hidden" name="column_mapping" value={mapping} />
            {feedback.sample && feedback.sample.length > 0 ? <p className="text-xs text-[var(--muted)] sm:col-span-2">Aperçu : {feedback.sample[0].filter(Boolean).slice(0, 4).join(" · ")}</p> : null}
          </CardContent>
        </Card>
      ) : null}
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="erp-form-actions flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href="/tresorerie/releves">Annuler</Link></Button>
        <Button disabled={pending}>{pending ? "Import…" : "Importer le relevé"}</Button>
      </div>
    </form>
  );
}
