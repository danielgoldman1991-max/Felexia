"use client";

import { useRef, useState } from "react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { ProductCombobox } from "@/components/sales/product-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { calculateInvoiceLine, calculateInvoiceTotals, createEmptyInvoiceLine } from "@/lib/invoice-calculations";
import { isIndivisibleUnit, normalizeIndivisibleQuantity } from "@/lib/sales-calculations";
import type { InvoiceLineFormValue, InvoiceProductOption } from "@/lib/invoice-types";
import type { TaxRateForSalesSelect, UnitForSalesSelect } from "@/lib/sales-types";

type Props = {
  lines: InvoiceLineFormValue[];
  onChange: (lines: InvoiceLineFormValue[]) => void;
  products: InvoiceProductOption[];
  units: UnitForSalesSelect[];
  taxRates: TaxRateForSalesSelect[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InvoiceLinesEditor({ lines, onChange, products, units, taxRates }: Props) {
  const [draft, setDraft] = useState<InvoiceLineFormValue>(() => createEmptyInvoiceLine());
  const [error, setError] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const totals = calculateInvoiceTotals(lines);
  const indivisible = isIndivisibleUnit(draft, units);

  function update(next: InvoiceLineFormValue) {
    setDraft(calculateInvoiceLine(next));
  }

  function handleProductChange(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return update({ ...draft, product_id: "", product_name: "" });
    const unit = units.find((item) => item.id === product.unit_id);
    const taxRate = taxRates.find((tax) => tax.id === product.tax_rate_id);
    setDraft(calculateInvoiceLine({
      ...draft,
      mode: "product",
      product_id: product.id,
      product_name: product.name,
      description: product.description?.trim() || product.name,
      unit_id: product.unit_id ?? "",
      unit_name: unit?.symbol ?? unit?.name ?? "",
      unit_price_ht: Number(product.sale_price_ht ?? 0),
      tax_rate_id: taxRate?.id ?? "",
      tax_rate: Number(taxRate?.rate ?? product.tax_rate_value ?? 0),
      quantity: 1,
      discount_rate: 0,
    }));
    setError(null);
  }

  function addLine() {
    const prepared = calculateInvoiceLine(draft);
    if (prepared.mode === "product" && !prepared.product_id) return setError("Selectionnez un article ou service.");
    if (!prepared.description.trim()) return setError("Saisissez une description.");
    if (prepared.quantity <= 0) return setError("La quantite doit etre superieure a zero.");
    if (isIndivisibleUnit(prepared, units) && !Number.isInteger(prepared.quantity)) return setError("La quantite doit etre entiere pour l'unite U.");
    if (prepared.unit_price_ht < 0) return setError("Le prix ne peut pas etre negatif.");
    onChange([...lines, { ...prepared, id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
    setDraft(createEmptyInvoiceLine());
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Ajouter une ligne</p>
          <span className="text-xs text-[var(--muted)]">Total ligne: <MoneyDisplay value={draft.total_ttc} /></span>
        </div>
        <div className="mb-3 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Type de ligne</span>
            <Select className="w-48" value={draft.mode} onChange={(event) => {
              const mode = event.target.value as InvoiceLineFormValue["mode"];
              if (mode === "free") {
                setDraft(calculateInvoiceLine({ ...createEmptyInvoiceLine(), mode: "free" }));
                requestAnimationFrame(() => descriptionRef.current?.focus());
              } else update({ ...draft, mode: "product", product_id: "", product_name: "" });
            }}>
              <option value="product">Article/service</option>
              <option value="free">Ligne libre</option>
            </Select>
          </label>
          <label className="flex min-w-80 flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Article / Service</span>
            <ProductCombobox products={products} value={draft.product_id} onChange={handleProductChange} disabled={draft.mode === "free"} />
          </label>
        </div>
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Description</span>
            <Input ref={descriptionRef} value={draft.description} onChange={(event) => update({ ...draft, description: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Unite</span>
            <Select value={draft.unit_id} onChange={(event) => {
              const unit = units.find((item) => item.id === event.target.value);
              const next = { ...draft, unit_id: event.target.value, unit_name: unit?.symbol ?? unit?.name ?? "" };
              update({ ...next, quantity: isIndivisibleUnit(next, units) ? normalizeIndivisibleQuantity(next.quantity) : next.quantity });
            }}>
              <option value="">--</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.symbol}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Prix HT</span>
            <Input type="number" min="0" step="0.01" value={draft.unit_price_ht} onChange={(event) => update({ ...draft, unit_price_ht: toNumber(event.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Quantite</span>
            <Input type="number" min={indivisible ? "1" : "0"} step={indivisible ? "1" : "0.001"} value={draft.quantity} onChange={(event) => {
              const quantity = toNumber(event.target.value);
              update({ ...draft, quantity: indivisible ? normalizeIndivisibleQuantity(quantity) : quantity });
            }} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Remise %</span>
            <Input type="number" min="0" max="100" step="0.01" value={draft.discount_rate} onChange={(event) => update({ ...draft, discount_rate: toNumber(event.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">TVA</span>
            <Select value={draft.tax_rate_id} onChange={(event) => {
              const taxRate = taxRates.find((tax) => tax.id === event.target.value);
              update({ ...draft, tax_rate_id: event.target.value, tax_rate: Number(taxRate?.rate ?? 0) });
            }}>
              <option value="">--</option>
              {taxRates.map((taxRate) => <option key={taxRate.id} value={taxRate.id}>{taxRate.name} ({taxRate.rate}%)</option>)}
            </Select>
          </label>
        </div>
        {error ? <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        <Button type="button" className="mt-3" onClick={addLine}>AJOUTER</Button>
      </div>

      <Table>
        <thead>
          <tr><Th>#</Th><Th>Origine</Th><Th>Produit</Th><Th>Description</Th><Th>Quantite</Th><Th>Unite</Th><Th>Prix HT</Th><Th>Remise</Th><Th>Total HT</Th><Th>TVA</Th><Th>Total TTC</Th><Th>Actions</Th></tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr><td colSpan={12} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">Aucune ligne. Ajoutez une ligne ci-dessus.</td></tr>
          ) : lines.map((line, index) => (
            <tr key={line.id}>
              <Td>{index + 1}</Td><Td>{line.source_label || "-"}</Td><Td>{line.product_name || "Ligne libre"}</Td><Td>{line.description}</Td><Td>{line.quantity}</Td><Td>{line.unit_name || "-"}</Td>
              <Td><MoneyDisplay value={line.unit_price_ht} /></Td><Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td><Td><MoneyDisplay value={line.subtotal_ht} /></Td><Td>{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</Td><Td><MoneyDisplay value={line.total_ttc} /></Td>
              <Td><Button type="button" variant="ghost" onClick={() => onChange(lines.filter((item) => item.id !== line.id))}>Supprimer</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex justify-end">
        <div className="space-x-6 text-sm">
          <span>Total HT: <MoneyDisplay value={totals.subtotal_ht} /></span>
          <span>Total TVA: <MoneyDisplay value={totals.tax_total} /></span>
          <span className="font-semibold">Total TTC: <MoneyDisplay value={totals.total_ttc} /></span>
        </div>
      </div>
    </div>
  );
}
