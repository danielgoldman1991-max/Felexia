"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SalesLinesEditor } from "@/components/sales/sales-lines-editor";
import { calculateSalesTotals } from "@/lib/sales-calculations";
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
  const totals = calculateSalesTotals(lines);

  return (
    <form action={formAction} className="space-y-5">
      {document ? <input type="hidden" name="id" value={document.id} /> : null}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="subtotal_ht" value={totals.subtotal_ht} />
      <input type="hidden" name="tax_total" value={totals.tax_total} />
      <input type="hidden" name="total_ttc" value={totals.total_ttc} />

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="Client *">
            <Select name="customer_id" defaultValue={document?.customer_id ?? ""} required>
              <option value="">Selectionner un client</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}{customer.city ? ` (${customer.city})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date du devis">
            <Input name="document_date" type="date" defaultValue={document?.document_date ?? new Date().toISOString().split("T")[0]} />
          </Field>
          <Field label="Validite jusqu'au">
            <Input name="valid_until" type="date" defaultValue={document?.valid_until ?? ""} />
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
