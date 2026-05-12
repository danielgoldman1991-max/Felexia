"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CustomerCombobox } from "@/components/sales/customer-combobox";
import { InvoiceLinesEditor } from "@/components/invoices/invoice-lines-editor";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerCreditNote } from "@/lib/credit-note-actions";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import type { CreditNoteActionResult, CustomerCreditNoteSourceType } from "@/lib/credit-note-types";
import type { InvoiceCustomerOption, InvoiceLineFormValue, InvoiceProductOption } from "@/lib/invoice-types";
import type { TaxRateForSalesSelect, UnitForSalesSelect } from "@/lib/sales-types";

function today() {
  return new Date().toISOString().split("T")[0];
}

export function CustomerCreditNoteForm({
  customers,
  products,
  units,
  taxRates,
  initialCustomerId = "",
  sourceInvoiceId = "",
  sourceReturnId = "",
  sourceReturnNumber = "",
  sourceType,
  defaultReason = "",
  initialLines = [],
}: {
  customers: InvoiceCustomerOption[];
  products: InvoiceProductOption[];
  units: UnitForSalesSelect[];
  taxRates: TaxRateForSalesSelect[];
  initialCustomerId?: string;
  sourceInvoiceId?: string;
  sourceReturnId?: string;
  sourceReturnNumber?: string;
  sourceType?: CustomerCreditNoteSourceType;
  defaultReason?: string;
  initialLines?: InvoiceLineFormValue[];
}) {
  const [state, formAction, pending] = useActionState<CreditNoteActionResult, FormData>(createCustomerCreditNote, { success: true });
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [lines, setLines] = useState(initialLines);
  const totals = calculateInvoiceTotals(lines);
  const hasMissingPrices = lines.some((line) => line.unit_price_ht <= 0);
  const defaultSourceType = sourceType ?? (sourceInvoiceId ? "invoice_partial" : "manual");
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="source_invoice_id" value={sourceInvoiceId} />
      <input type="hidden" name="source_return_id" value={sourceReturnId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <Card>
        <CardHeader><h2 className="font-semibold">Informations avoir</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Client *</span>
            <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} placeholder="Rechercher un client..." />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Date avoir</span>
            <DateField name="credit_note_date" defaultValue={today()} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Origine</span>
            {sourceReturnId ? (
              <>
                <input type="hidden" name="source_type" value="return" />
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Bon de retour {sourceReturnNumber || sourceReturnId}
                </div>
              </>
            ) : (
              <Select name="source_type" defaultValue={defaultSourceType}>
                <option value="manual">Libre</option>
                <option value="invoice_total">Facture totale</option>
                <option value="invoice_partial">Facture partielle</option>
                <option value="commercial_gesture">Geste commercial</option>
                <option value="correction">Correction</option>
              </Select>
            )}
          </label>
          {sourceReturnId && hasMissingPrices ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 lg:col-span-2">
              Prix a completer manuellement pour une ou plusieurs lignes.
            </div>
          ) : null}
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Motif</span>
            <Input name="reason" defaultValue={defaultReason} placeholder="Correction facture, geste commercial..." />
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Notes client</span>
            <Textarea name="notes" />
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Notes internes</span>
            <Textarea name="internal_notes" />
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Lignes d&apos;avoir</h2></CardHeader>
        <CardContent><InvoiceLinesEditor lines={lines} onChange={setLines} products={products} units={units} taxRates={taxRates} /></CardContent>
      </Card>
      <Card><CardContent className="grid gap-3 md:grid-cols-3"><div>Total HT : <strong><MoneyDisplay value={totals.subtotal_ht} /></strong></div><div>TVA : <strong><MoneyDisplay value={totals.tax_total} /></strong></div><div>Total TTC : <strong><MoneyDisplay value={totals.total_ttc} /></strong></div></CardContent></Card>
      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3"><Link href="/facturation/avoirs"><Button type="button" variant="secondary">Annuler</Button></Link><Button disabled={pending || !customerId || lines.length === 0}>Creer avoir</Button></div>
    </form>
  );
}
