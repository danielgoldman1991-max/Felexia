"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CommercialLinesEditor } from "@/components/commerce/commercial-lines-editor";
import type { CommerceActionResult, CommerceLineValue, DeliveryNoteLineRecord, DeliveryNoteRecord, ProductForSelect } from "@/lib/commerce-types";

type UnitOption = { id: string; name: string; symbol: string };
type TaxRateOption = { id: string; name: string; rate: number };

type Props = {
  mode: "create" | "edit";
  delivery?: DeliveryNoteRecord;
  lines?: DeliveryNoteLineRecord[];
  orderId?: string;
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

export function DeliveryNoteForm({ mode, delivery, lines: initialLines, orderId, customers, products, units, taxRates, defaultTaxRate, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const [docLines, setDocLines] = useState<CommerceLineValue[]>(() => {
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
        unit_price_ht: 0,
        discount_rate: 0,
        tax_rate_id: "",
        tax_rate: 0,
        subtotal_ht: 0,
        tax_amount: 0,
        total_ttc: 0,
      }));
    }
    return [];
  });

  return (
    <form action={formAction} className="space-y-5">
      {delivery ? <input type="hidden" name="id" value={delivery.id} /> : null}
      {orderId ? <input type="hidden" name="order_id" value={orderId} /> : null}
      <input type="hidden" name="lines" value={JSON.stringify(docLines)} />

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="Client *">
            <Select name="third_party_id" defaultValue={delivery?.third_party_id ?? ""} required>
              <option value="">Selectionner un client</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date document">
            <Input name="document_date" type="date" defaultValue={delivery?.document_date ?? new Date().toISOString().split("T")[0]} />
          </Field>
          <Field label="Date livraison">
            <Input name="delivery_date" type="date" defaultValue={delivery?.delivery_date ?? ""} />
          </Field>
          <Field label="Adresse livraison">
            <Textarea name="delivery_address" defaultValue={delivery?.delivery_address ?? ""} rows={2} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes du bon de livraison</h2></CardHeader>
        <CardContent>
          <CommercialLinesEditor
            lines={docLines}
            onChange={setDocLines}
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
            <Textarea name="notes" defaultValue={delivery?.notes ?? ""} rows={4} />
          </Field>
          <Field label="Notes internes">
            <Textarea name="internal_notes" defaultValue={delivery?.internal_notes ?? ""} rows={4} />
          </Field>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--background)] py-4">
        <Link href={delivery ? `/livraisons/${delivery.id}` : "/livraisons"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
        <Button disabled={pending}>
          {mode === "create" ? "Creer bon de livraison" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
