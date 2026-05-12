"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AccountingActionResult, AccountingSettingsRecord } from "@/lib/accounting-types";

type Props = {
  action: (prev: AccountingActionResult, formData: FormData) => Promise<AccountingActionResult>;
  settings: AccountingSettingsRecord | null;
};

export function SettingsForm({ action, settings }: Props) {
  const [state, formAction, pending] = useActionState(action, { success: true });

  const fields: { label: string; name: string; defaultValue: string; description: string }[] = [
    { label: "Journal ventes", name: "sales_journal_code", defaultValue: settings?.sales_journal_code ?? "VE", description: "Code du journal des ventes" },
    { label: "Journal achats", name: "purchases_journal_code", defaultValue: settings?.purchases_journal_code ?? "AC", description: "Code du journal des achats" },
    { label: "Journal banque", name: "bank_journal_code", defaultValue: settings?.bank_journal_code ?? "BQ", description: "Code du journal de banque" },
    { label: "Journal caisse", name: "cash_journal_code", defaultValue: settings?.cash_journal_code ?? "CA", description: "Code du journal de caisse" },
    { label: "Journal OD", name: "od_journal_code", defaultValue: settings?.od_journal_code ?? "OD", description: "Code du journal des operations diverses" },
    { label: "Compte client", name: "default_customer_account_code", defaultValue: settings?.default_customer_account_code ?? "3421", description: "Compte par defaut pour les clients" },
    { label: "Compte fournisseur", name: "default_supplier_account_code", defaultValue: settings?.default_supplier_account_code ?? "4411", description: "Compte par defaut pour les fournisseurs" },
    { label: "Compte ventes", name: "default_sales_account_code", defaultValue: settings?.default_sales_account_code ?? "7111", description: "Compte par defaut pour les ventes" },
    { label: "Compte achats", name: "default_purchase_account_code", defaultValue: settings?.default_purchase_account_code ?? "6111", description: "Compte par defaut pour les achats" },
    { label: "Compte TVA collectee", name: "default_sales_vat_account_code", defaultValue: settings?.default_sales_vat_account_code ?? "4455", description: "Compte de TVA facturee" },
    { label: "Compte TVA recuperable", name: "default_purchase_vat_account_code", defaultValue: settings?.default_purchase_vat_account_code ?? "34552", description: "Compte de TVA recuperable" },
    { label: "Compte banque", name: "default_bank_account_code", defaultValue: settings?.default_bank_account_code ?? "5141", description: "Compte bancaire par defaut" },
    { label: "Compte caisse", name: "default_cash_account_code", defaultValue: settings?.default_cash_account_code ?? "5161", description: "Compte de caisse par defaut" },
    { label: "Compte frais bancaires", name: "default_bank_fees_account_code", defaultValue: settings?.default_bank_fees_account_code ?? "6147", description: "Compte des frais bancaires" },
    { label: "Prefixe numerotation", name: "numbering_prefix", defaultValue: settings?.numbering_prefix ?? "PC", description: "Prefixe pour les numeros d'ecritures" },
  ];

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader><h2 className="font-semibold">Journaux</h2></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.slice(0, 5).map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{field.label}</label>
              <input
                type="text"
                name={field.name}
                defaultValue={field.defaultValue}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm font-mono outline-none focus:border-[var(--primary)]"
              />
              <p className="mt-0.5 text-xs text-[var(--muted)]">{field.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Comptes par defaut</h2></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.slice(5).map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{field.label}</label>
              <input
                type="text"
                name={field.name}
                defaultValue={field.defaultValue}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm font-mono outline-none focus:border-[var(--primary)]"
              />
              <p className="mt-0.5 text-xs text-[var(--muted)]">{field.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{state.error}</p>
      ) : state.success && state.data ? (
        <p className="rounded-md bg-[var(--success-soft)] p-3 text-sm text-[var(--success)]">Parametres mis a jour.</p>
      ) : null}

      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Enregistrement..." : "Enregistrer les parametres"}</Button>
      </div>
    </form>
  );
}
