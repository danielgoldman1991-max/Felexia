"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SupplierCombobox } from "@/components/purchases/supplier-combobox";
import { InvoiceLinesEditor } from "@/components/invoices/invoice-lines-editor";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/ui/date-field";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { createSupplierCreditNote, updateSupplierCreditNote } from "@/lib/supplier-credit-note-actions";
import type { SupplierCreditNoteRecord } from "@/lib/supplier-credit-note-types";
import type { InvoiceCustomerOption, InvoiceLineFormValue, InvoiceProductOption } from "@/lib/invoice-types";
import type { TaxRateForSalesSelect, UnitForSalesSelect } from "@/lib/sales-types";

export function SupplierCreditNoteForm({ suppliers, products, units, taxRates, initialSupplierId = "", sourceInvoiceId = "", initialLines = [], creditNote }: {
  suppliers: InvoiceCustomerOption[]; products: InvoiceProductOption[]; units: UnitForSalesSelect[]; taxRates: TaxRateForSalesSelect[];
  initialSupplierId?: string; sourceInvoiceId?: string; initialLines?: InvoiceLineFormValue[]; creditNote?: SupplierCreditNoteRecord;
}) {
  const [supplierId, setSupplierId] = useState(creditNote?.supplier_id ?? initialSupplierId);
  const [lines, setLines] = useState(initialLines);
  const [state, formAction, pending] = useActionState(creditNote ? updateSupplierCreditNote : createSupplierCreditNote, { success: true });
  const totals = calculateInvoiceTotals(lines);
  const supplier = suppliers.find(row => row.id === supplierId);
  const sourceId = creditNote?.source_invoice_id ?? sourceInvoiceId;
  return <form action={formAction} className="space-y-5">
    <input type="hidden" name="id" value={creditNote?.id ?? ""} />
    <input type="hidden" name="supplier_id" value={supplierId} />
    <input type="hidden" name="source_invoice_id" value={sourceId} />
    <input type="hidden" name="lines" value={JSON.stringify(lines)} />
    <Card><CardHeader><h2 className="font-semibold">Informations de l’avoir fournisseur</h2><p className="text-sm text-[var(--muted)]">Enregistrez le document reçu du fournisseur, puis affectez-le à une facture à payer.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Fournisseur *</label>{sourceId ? <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">{supplier?.name ?? creditNote?.supplier_name ?? "Fournisseur de la facture source"}</p> : <SupplierCombobox suppliers={suppliers.map(row => ({ id: row.id, name: row.name, ice: row.ice ?? null }))} value={supplierId} onChange={setSupplierId} />}</div>
      <label className="space-y-2 text-sm font-medium">Référence de l’avoir fournisseur *<Input name="supplier_credit_note_number" defaultValue={creditNote?.supplier_credit_note_number ?? ""} maxLength={120} placeholder="La référence du document reçu" required /></label>
      <label className="space-y-2 text-sm font-medium">Date de l’avoir *<DateField name="credit_note_date" defaultValue={creditNote?.credit_note_date ?? new Date().toISOString().slice(0, 10)} required /></label>
      {sourceId ? <p className="text-sm text-[var(--muted)] md:col-span-2">Facture source : <Link href={`/achats/factures/${sourceId}`} className="font-medium text-[var(--primary)] underline">{creditNote?.source_invoice_number ?? "Consulter la facture fournisseur"}</Link>. Adaptez les quantités et montants pour reprendre uniquement ce qui est crédité.</p> : null}
      <label className="space-y-2 text-sm font-medium md:col-span-2">Motif de l’avoir<Input name="reason" defaultValue={creditNote?.reason ?? ""} maxLength={500} placeholder="Retour, correction de prix, remise…" /></label>
      <label className="space-y-2 text-sm font-medium md:col-span-2">Notes sur le document<Textarea name="notes" defaultValue={creditNote?.notes ?? ""} maxLength={4000} /></label>
      <details className="md:col-span-2"><summary className="cursor-pointer text-sm font-medium text-[var(--muted)]">Notes internes (facultatif)</summary><label className="mt-3 block space-y-2 text-sm">Informations internes, absentes de l’impression<Textarea name="internal_notes" defaultValue={creditNote?.internal_notes ?? ""} maxLength={4000} /></label></details>
    </CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">Lignes de l’avoir</h2><p className="text-sm text-[var(--muted)]">Saisissez des montants positifs. L’avoir réduira la somme due au fournisseur.</p></CardHeader><CardContent><InvoiceLinesEditor lines={lines} onChange={setLines} products={products} units={units} taxRates={taxRates} /></CardContent></Card>
    <Card><CardContent className="grid gap-4 sm:grid-cols-3"><div className="text-sm text-[var(--muted)]">Total HT net<br /><strong className="text-lg text-[var(--foreground)]"><MoneyDisplay value={totals.subtotal_ht} /></strong></div><div className="text-sm text-[var(--muted)]">TVA<br /><strong className="text-lg text-[var(--foreground)]"><MoneyDisplay value={totals.tax_total} /></strong></div><div className="text-sm text-[var(--muted)]">Total TTC<br /><strong className="text-lg text-[var(--foreground)]"><MoneyDisplay value={totals.total_ttc} /></strong></div></CardContent></Card>
    {!state.success && state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p> : null}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" asChild><Link href={creditNote ? `/achats/avoirs/${creditNote.id}` : "/achats/avoirs"}>Annuler</Link></Button><Button type="submit" disabled={pending || !supplierId || lines.length === 0}>{pending ? "Enregistrement…" : creditNote ? "Enregistrer les modifications" : "Créer l’avoir fournisseur"}</Button></div>
  </form>;
}
