"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CommercialLinesEditor } from "@/components/commerce/commercial-lines-editor";
import { calculateTotals } from "@/lib/commerce-calculations";
import type { CommerceActionResult, CommerceLineFormValue, ProductForSelect, SalesQuoteLineRecord, SalesQuoteRecord } from "@/lib/commerce-types";

type UnitOption = { id: string; name: string; symbol: string };
type TaxRateOption = { id: string; name: string; rate: number };

type Props = {
  mode: "create" | "edit";
  quote?: SalesQuoteRecord;
  lines?: SalesQuoteLineRecord[];
  customers: { id: string; name: string; city: string | null }[];
  products: ProductForSelect[];
  units: UnitOption[];
  taxRates: TaxRateOption[];
  defaultTaxRate?: { id: string; rate: number } | null;
  action: (state: CommerceActionResult, formData: FormData) => Promise<CommerceActionResult>;
};

const initialState: CommerceActionResult = { success: true };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function SalesQuoteForm({ mode, quote, lines: initialLines, customers, products, units, taxRates, defaultTaxRate, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const [lines, setLines] = useState<CommerceLineFormValue[]>(() => {
    if (initialLines && initialLines.length > 0) {
      return initialLines.map((l) => ({
        id: l.id,
        mode: l.product_id ? "product" : "free",
        product_id: l.product_id ?? "",
        product_name: l.product_name ?? "",
        description: l.description,
        quantity: l.quantity,
        unit_id: l.unit_id ?? "",
        unit_name: l.unit_symbol ?? "",
        unit_price_ht: l.unit_price_ht,
        discount_rate: l.discount_rate,
        tax_rate_id: l.tax_rate_id ?? "",
        tax_rate: l.tax_rate,
        subtotal_ht: l.subtotal_ht,
        tax_amount: l.tax_amount,
        total_ttc: l.total_ttc,
      }));
    }
    return [];
  });
  const totals = calculateTotals(lines);

  return (
    <form action={formAction} className="space-y-5">
      {quote ? <input type="hidden" name="id" value={quote.id} /> : null}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="subtotal_ht" value={totals.subtotal_ht} />
      <input type="hidden" name="tax_total" value={totals.tax_total} />
      <input type="hidden" name="total_ttc" value={totals.total_ttc} />

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="Client *">
            <Select name="third_party_id" defaultValue={quote?.third_party_id ?? ""} required>
              <option value="">Selectionner un client</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date document">
            <DateField name="document_date" defaultValue={quote?.document_date ?? new Date().toISOString().split("T")[0]} />
          </Field>
          <Field label="Validite jusqu au">
            <DateField name="valid_until" defaultValue={quote?.valid_until ?? ""} />
          </Field>
          <Field label="Delai paiement (jours)">
            <Input name="payment_terms_days" type="number" min="0" defaultValue={quote?.payment_terms_days ?? 30} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes du devis</h2></CardHeader>
        <CardContent>
          <CommercialLinesEditor
            lines={lines}
            onChange={setLines}
            products={products}
            units={units}
            taxRates={taxRates}
            defaultTaxRate={defaultTaxRate ? { id: defaultTaxRate.id, name: "", rate: defaultTaxRate.rate } : null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Notes</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Field label="Notes">
            <Textarea name="notes" defaultValue={quote?.notes ?? ""} rows={4} />
          </Field>
          <Field label="Notes internes">
            <Textarea name="internal_notes" defaultValue={quote?.internal_notes ?? ""} rows={4} />
          </Field>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--background)] py-4">
        <Link href={quote ? `/devis/${quote.id}` : "/devis"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
        <Button disabled={pending}>
          {mode === "create" ? "Creer devis" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
