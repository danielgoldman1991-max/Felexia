"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/erp/money-display";
import { ProductCombobox } from "@/components/sales/product-combobox";
import { QuickArticleModal } from "@/components/sales/quick-article-modal";
import {
  calculateSalesLine,
  calculateSalesTotals,
  createEmptySalesLine,
  isIndivisibleUnit,
  normalizeIndivisibleQuantity,
} from "@/lib/sales-calculations";
import type {
  ProductForSalesSelect,
  SalesLineFormValue,
  TaxRateForSalesSelect,
  UnitForSalesSelect,
} from "@/lib/sales-types";
import type { ProductCategory, TaxRate, Unit } from "@/lib/product-types";

type Props = {
  lines: SalesLineFormValue[];
  onChange: (lines: SalesLineFormValue[]) => void;
  products: ProductForSalesSelect[];
  units: UnitForSalesSelect[];
  taxRates: TaxRateForSalesSelect[];
  defaultTaxRate?: TaxRateForSalesSelect | null;
  productCategories?: ProductCategory[];
  allUnits?: Unit[];
  allTaxRates?: TaxRate[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createLineId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatQuantity(line: SalesLineFormValue, units: UnitForSalesSelect[]) {
  if (isIndivisibleUnit(line, units)) return String(normalizeIndivisibleQuantity(line.quantity));

  return new Intl.NumberFormat("fr-MA", {
    maximumFractionDigits: 3,
  }).format(line.quantity);
}

export function SalesLinesEditor({ lines, onChange, products, units, taxRates, defaultTaxRate, productCategories, allUnits, allTaxRates }: Props) {
  const [draftLine, setDraftLine] = useState<SalesLineFormValue>(() => createEmptySalesLine(defaultTaxRate));
  const [error, setError] = useState<string | null>(null);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const totals = calculateSalesTotals(lines);
  const draftUsesIndivisibleUnit = isIndivisibleUnit(draftLine, units);

  function updateDraft(nextLine: SalesLineFormValue) {
    setDraftLine(calculateSalesLine(nextLine));
  }

  function handleProductChange(productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);
    if (!selectedProduct) {
      updateDraft({ ...draftLine, product_id: "", product_name: "" });
      return;
    }

    const selectedUnit = units.find((unit) => unit.id === selectedProduct.unit_id);
    const selectedTaxRate =
      taxRates.find((tax) => tax.id === selectedProduct.tax_rate_id) ??
      defaultTaxRate ??
      null;

    const nextLine = calculateSalesLine({
      ...draftLine,
      mode: "product",
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      description:
        selectedProduct.description && selectedProduct.description.trim().length > 0
          ? selectedProduct.description
          : selectedProduct.name,
      unit_id: selectedProduct.unit_id ?? "",
      unit_name: selectedUnit?.symbol ?? selectedUnit?.name ?? "",
      unit_price_ht: Number(selectedProduct.sale_price_ht ?? 0),
      tax_rate_id: selectedTaxRate?.id ?? "",
      tax_rate: Number(selectedTaxRate?.rate ?? selectedProduct.tax_rate_value ?? 0),
      quantity: 1,
      discount_rate: 0,
    });

    setDraftLine(nextLine);
    setError(null);
  }

  function handleModeChange(mode: SalesLineFormValue["mode"]) {
    if (mode === "free") {
      setDraftLine(
        calculateSalesLine({
          ...createEmptySalesLine(defaultTaxRate),
          id: draftLine.id,
          mode: "free",
        }),
      );
      setError(null);
      requestAnimationFrame(() => descriptionInputRef.current?.focus());
      return;
    }

    updateDraft({
      ...draftLine,
      mode: "product",
      product_id: "",
      product_name: "",
    });
    setError(null);
  }

  function handleUnitChange(unitId: string) {
    const selectedUnit = units.find((unit) => unit.id === unitId);
    const nextLine = {
      ...draftLine,
      unit_id: unitId,
      unit_name: selectedUnit?.symbol ?? selectedUnit?.name ?? "",
    };

    updateDraft({
      ...nextLine,
      quantity: isIndivisibleUnit(nextLine, units)
        ? normalizeIndivisibleQuantity(nextLine.quantity)
        : nextLine.quantity,
    });
  }

  function handleTaxRateChange(taxRateId: string) {
    const selectedTaxRate = taxRates.find((tax) => tax.id === taxRateId);
    updateDraft({
      ...draftLine,
      tax_rate_id: taxRateId,
      tax_rate: Number(selectedTaxRate?.rate ?? 0),
    });
  }

  function handleAddLine() {
    const preparedLine = calculateSalesLine(draftLine);

    if (preparedLine.mode === "product" && !preparedLine.product_id) {
      setError("Selectionnez un article ou service.");
      return;
    }
    if (!preparedLine.description.trim()) {
      setError("Saisissez une description.");
      return;
    }
    if (Number(preparedLine.quantity) <= 0) {
      setError("La quantite doit etre superieure a zero.");
      return;
    }
    if (isIndivisibleUnit(preparedLine, units) && !Number.isInteger(Number(preparedLine.quantity))) {
      setError("La quantite doit etre un nombre entier pour l'unite U.");
      return;
    }
    if (Number(preparedLine.unit_price_ht) < 0) {
      setError("Le prix ne peut pas etre negatif.");
      return;
    }

    const lineToAdd: SalesLineFormValue = {
      ...preparedLine,
      id: createLineId(),
    };

    onChange([...lines, lineToAdd]);
    setDraftLine(createEmptySalesLine(defaultTaxRate));
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Ajouter une ligne</p>
          <span className="text-xs text-[var(--muted)]">
            Total ligne: <MoneyDisplay value={draftLine.total_ttc} />
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Type de ligne</span>
            <Select
              className="w-56"
              value={draftLine.mode}
              onChange={(event) => {
                const mode = event.target.value as SalesLineFormValue["mode"];
                handleModeChange(mode);
              }}
            >
              <option value="product">Article/service</option>
              <option value="free">Ligne libre</option>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Article / Service</span>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ProductCombobox
                  products={products}
                  value={draftLine.product_id}
                  onChange={handleProductChange}
                  disabled={draftLine.mode === "free"}
                  placeholder="Rechercher un article ou service..."
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={draftLine.mode === "free"}
                onClick={() => setQuickModalOpen(true)}
                className="shrink-0 text-xs"
              >
                + Nouvel article
              </Button>
            </div>
          </label>
        </div>
        <QuickArticleModal
          open={quickModalOpen}
          onClose={() => setQuickModalOpen(false)}
          onCreated={(productId, productName, unitId, unitName, salePriceHt, taxRateId, taxRateValue) => {
            const nextLine = calculateSalesLine({
              ...createEmptySalesLine(defaultTaxRate),
              id: draftLine.id,
              mode: "product",
              product_id: productId,
              product_name: productName,
              description: productName,
              unit_id: unitId,
              unit_name: unitName,
              unit_price_ht: salePriceHt,
              tax_rate_id: taxRateId,
              tax_rate: taxRateValue,
              quantity: 1,
            });
            setDraftLine(nextLine);
            setQuickModalOpen(false);
          }}
          categories={productCategories ?? []}
          units={allUnits ?? []}
          taxRates={allTaxRates ?? []}
        />

        <div className="mb-3 grid gap-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Description</span>
            <Input
              ref={descriptionInputRef}
              value={draftLine.description}
              onChange={(event) => updateDraft({ ...draftLine, description: event.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Unite</span>
            <Select value={draftLine.unit_id} onChange={(event) => handleUnitChange(event.target.value)}>
              <option value="">--</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.symbol}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Prix unitaire HT</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draftLine.unit_price_ht}
              onChange={(event) => updateDraft({ ...draftLine, unit_price_ht: toNumber(event.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Quantite</span>
            <Input
              type="number"
              min={draftUsesIndivisibleUnit ? "1" : "0"}
              step={draftUsesIndivisibleUnit ? "1" : "0.001"}
              value={draftLine.quantity}
              onChange={(event) => {
                const quantity = toNumber(event.target.value);
                updateDraft({
                  ...draftLine,
                  quantity: draftUsesIndivisibleUnit
                    ? normalizeIndivisibleQuantity(quantity)
                    : quantity,
                });
              }}
            />
            {draftUsesIndivisibleUnit ? (
              <span className="text-[11px] text-[var(--muted)]">
                Cette unite est indivisible : saisissez une quantite entiere.
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Remise %</span>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draftLine.discount_rate}
              onChange={(event) => updateDraft({ ...draftLine, discount_rate: toNumber(event.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">TVA</span>
            <Select value={draftLine.tax_rate_id} onChange={(event) => handleTaxRateChange(event.target.value)}>
              {taxRates.map((taxRate) => (
                <option key={taxRate.id} value={taxRate.id}>{taxRate.name}</option>
              ))}
            </Select>
          </label>
        </div>

        {error ? (
          <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : null}

        <Button type="button" onClick={handleAddLine}>AJOUTER</Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Produit</Th>
            <Th>Description</Th>
            <Th>Quantite</Th>
            <Th>Unite</Th>
            <Th>Prix HT</Th>
            <Th>Remise %</Th>
            <Th>Total HT</Th>
            <Th>TVA %</Th>
            <Th>Total TTC</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={11} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                Aucune ligne. Ajoutez une ligne ci-dessus.
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={line.id}>
                <Td>{index + 1}</Td>
                <Td>{line.product_name || "Ligne libre"}</Td>
                <Td>{line.description}</Td>
                <Td>{formatQuantity(line, units)}</Td>
                <Td>{line.unit_name || "-"}</Td>
                <Td><MoneyDisplay value={line.unit_price_ht} /></Td>
                <Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td>
                <Td><MoneyDisplay value={line.subtotal_ht} /></Td>
                <Td>{line.tax_rate_id ? `${line.tax_rate}%` : "-"}</Td>
                <Td><MoneyDisplay value={line.total_ttc} /></Td>
                <Td>
                  <Button type="button" variant="ghost" onClick={() => onChange(lines.filter((item) => item.id !== line.id))}>
                    Supprimer
                  </Button>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <div className="flex justify-end">
        <div className="space-x-6 text-sm">
          <span>Total HT: <MoneyDisplay value={totals.subtotal_ht} /></span>
          <span>Total TVA: <MoneyDisplay value={totals.tax_total} /></span>
          <span className="font-semibold">Total TTC: <MoneyDisplay value={totals.total_ttc} /></span>
        </div>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <pre className="hidden">{JSON.stringify(lines, null, 2)}</pre>
      ) : null}
    </div>
  );
}
