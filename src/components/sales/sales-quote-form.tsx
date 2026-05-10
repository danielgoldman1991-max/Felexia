"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Textarea } from "@/components/ui/textarea";
import { CustomerCombobox } from "@/components/sales/customer-combobox";
import { SalesLinesEditor } from "@/components/sales/sales-lines-editor";
import { calculateSalesTotals } from "@/lib/sales-calculations";
import { PAYMENT_TERMS_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import type {
  CustomerForSalesSelect,
  ProductForSalesSelect,
  SalesActionResult,
  SalesDocumentLineRecord,
  SalesDocumentRecord,
  SalesLineFormValue,
  TaxRateForSalesSelect,
  UnitForSalesSelect,
} from "@/lib/sales-types";

type Props = {
  mode: "create" | "edit";
  document?: SalesDocumentRecord;
  lines?: SalesDocumentLineRecord[];
  customers: CustomerForSalesSelect[];
  products: ProductForSalesSelect[];
  units: UnitForSalesSelect[];
  taxRates: TaxRateForSalesSelect[];
  defaultTaxRate?: TaxRateForSalesSelect | null;
  action: (state: SalesActionResult, formData: FormData) => Promise<SalesActionResult>;
};

const initialState: SalesActionResult = { success: true };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function SalesQuoteForm({
  mode,
  document,
  lines: initialLines,
  customers,
  products,
  units,
  taxRates,
  defaultTaxRate,
  action,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedCustomerId, setSelectedCustomerId] = useState(document?.customer_id ?? "");
  const [paymentTerms, setPaymentTerms] = useState(document?.payment_terms ?? "");
  const [paymentMethod, setPaymentMethod] = useState(document?.payment_method ?? "");
  const [paymentTermsDays, setPaymentTermsDays] = useState(document?.payment_terms_days ?? null);
  const [customPaymentTerms, setCustomPaymentTerms] = useState(document?.custom_payment_terms ?? "");
  const [customPaymentMethod, setCustomPaymentMethod] = useState(document?.custom_payment_method ?? "");
  const [lines, setLines] = useState<SalesLineFormValue[]>(() => {
    if (!initialLines?.length) return [];
    return initialLines.map((line) => ({
      id: line.id,
      mode: line.product_id ? "product" : "free",
      product_id: line.product_id ?? "",
      product_name: line.product_name ?? "",
      description: line.description,
      quantity: line.quantity,
      unit_id: line.unit_id ?? "",
      unit_name: line.unit_name ?? "",
      unit_price_ht: line.unit_price_ht,
      discount_rate: line.discount_rate,
      tax_rate_id: line.tax_rate_id ?? "",
      tax_rate: line.tax_rate,
      subtotal_ht: line.subtotal_ht,
      tax_amount: line.tax_amount,
      total_ttc: line.total_ttc,
    }));
  });

  function handleCustomerChange(id: string) {
    setSelectedCustomerId(id);
    const customer = customers.find((c) => c.id === id);
    if (customer && !document) {
      setPaymentTerms(customer.payment_terms ?? "");
      setPaymentMethod(customer.payment_method ?? "");
      setPaymentTermsDays(customer.payment_terms_days ?? null);
      setCustomPaymentTerms(customer.custom_payment_terms ?? "");
      setCustomPaymentMethod(customer.custom_payment_method ?? "");
    }
  }

  const totals = calculateSalesTotals(lines);

  return (
    <form action={formAction} className="space-y-5">
      {document ? <input type="hidden" name="id" value={document.id} /> : null}
      <input type="hidden" name="customer_id" value={selectedCustomerId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="subtotal_ht" value={totals.subtotal_ht} />
      <input type="hidden" name="tax_total" value={totals.tax_total} />
      <input type="hidden" name="total_ttc" value={totals.total_ttc} />
      <input type="hidden" name="payment_terms_days" value={paymentTermsDays ?? ""} />

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Client / Prospect *</span>
            <CustomerCombobox
              customers={customers}
              value={selectedCustomerId}
              onChange={handleCustomerChange}
              placeholder="Rechercher un client ou prospect..."
            />
          </div>
          <Field label="Date du devis">
            <DateField name="document_date" defaultValue={document?.document_date ?? new Date().toISOString().split("T")[0]} />
          </Field>
          <Field label="Validite jusqu'au">
            <DateField name="valid_until" defaultValue={document?.valid_until ?? ""} placeholder="jj/mm/aaaa" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes du devis</h2></CardHeader>
        <CardContent>
          <SalesLinesEditor
            lines={lines}
            onChange={setLines}
            products={products}
            units={units}
            taxRates={taxRates}
            defaultTaxRate={defaultTaxRate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Conditions commerciales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="Conditions de paiement">
            <select
              name="payment_terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            >
              <option value="">-- Selectionner --</option>
              {PAYMENT_TERMS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Modalites de paiement">
            <select
              name="payment_method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            >
              <option value="">-- Selectionner --</option>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          {paymentTerms === "custom" ? (
            <Field label="Detail condition personnalisee">
              <input
                name="custom_payment_terms"
                value={customPaymentTerms}
                onChange={(e) => setCustomPaymentTerms(e.target.value)}
                className="flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="Decrivez la condition..."
              />
            </Field>
          ) : null}
          {paymentMethod === "other" ? (
            <Field label="Detail modalite personnalisee">
              <input
                name="custom_payment_method"
                value={customPaymentMethod}
                onChange={(e) => setCustomPaymentMethod(e.target.value)}
                className="flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="Decrivez la modalite..."
              />
            </Field>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Field label="Notes client">
            <Textarea name="notes" defaultValue={document?.notes ?? ""} rows={4} />
          </Field>
          <Field label="Notes internes">
            <Textarea name="internal_notes" defaultValue={document?.internal_notes ?? ""} rows={4} />
          </Field>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--background)] py-4">
        <Link href={document ? `/vente/devis/${document.id}` : "/vente/devis"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
        <Button disabled={pending}>
          {mode === "create" ? "Creer devis" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
