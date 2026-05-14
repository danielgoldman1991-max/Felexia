"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/erp/money-display";
import {
  calculateLine,
  calculateTotals,
  createEmptyDraftLine,
} from "@/lib/commerce-calculations";
import type { CommerceLineFormValue, ProductForSelect } from "@/lib/commerce-types";

type UnitForSelect = { id: string; name: string; symbol: string };
type TaxRateForSelect = { id: string; name: string; rate: number };

type Props = {
  lines: CommerceLineFormValue[];
  onChange: (lines: CommerceLineFormValue[]) => void;
  products: ProductForSelect[];
  units: UnitForSelect[];
  taxRates: TaxRateForSelect[];
  defaultTaxRate?: TaxRateForSelect | null;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTempLineId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CommercialLinesEditor({ lines, onChange, products, units, taxRates, defaultTaxRate }: Props) {
  const [draftLine, setDraftLine] = useState<CommerceLineFormValue>(() => createEmptyDraftLine(defaultTaxRate));
  const [error, setError] = useState<string | null>(null);
  const totals = calculateTotals(lines);

  function setCalculatedDraftLine(nextLine: CommerceLineFormValue) {
    setDraftLine(calculateLine(nextLine));
  }

  function handleProductChange(productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);

    if (!selectedProduct) {
      setCalculatedDraftLine({
        ...draftLine,
        mode: "free",
        product_id: "",
        product_name: "",
      });
      return;
    }

    const selectedUnit = units.find((unit) => unit.id === selectedProduct.unit_id);

    const selectedTaxRate =
      taxRates.find((tax) => tax.id === selectedProduct.tax_rate_id) ??
      defaultTaxRate ??
      null;

    const nextLine = calculateLine({
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
      quantity: Number(draftLine.quantity || 1),
      discount_rate: Number(draftLine.discount_rate || 0),
    });

    setDraftLine(nextLine);
    setError(null);
  }

  function handleUnitChange(unitId: string) {
    const selectedUnit = units.find((unit) => unit.id === unitId);
    setCalculatedDraftLine({
      ...draftLine,
      unit_id: unitId,
      unit_name: selectedUnit?.symbol ?? selectedUnit?.name ?? "",
    });
  }

  function handleTaxChange(taxRateId: string) {
    const selectedTaxRate = taxRates.find((tax) => tax.id === taxRateId);
    setCalculatedDraftLine({
      ...draftLine,
      tax_rate_id: taxRateId,
      tax_rate: Number(selectedTaxRate?.rate ?? 0),
    });
  }

  function handleAddLine() {
    const preparedLine = calculateLine(draftLine);

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

    if (Number(preparedLine.unit_price_ht) < 0) {
      setError("Le prix ne peut pas etre negatif.");
      return;
    }

    const lineToAdd: CommerceLineFormValue = {
      ...preparedLine,
      id: createTempLineId(),
    };

    const nextLines = [...lines, lineToAdd];
    onChange(nextLines);

    setDraftLine(createEmptyDraftLine(defaultTaxRate));
    setError(null);
  }

  function removeLine(lineId: string) {
    onChange(lines.filter((line) => line.id !== lineId));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Ajout nouvelle ligne</p>
          <p className="text-xs text-[var(--muted)]">
            Total ligne: <MoneyDisplay value={draftLine.total_ttc} />
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Type de ligne</span>
            <Select
              className="w-56"
              value={draftLine.mode}
              onChange={(event) => {
                const mode = event.target.value as CommerceLineFormValue["mode"];
                setCalculatedDraftLine({
                  ...draftLine,
                  mode,
                  product_id: mode === "free" ? "" : draftLine.product_id,
                  product_name: mode === "free" ? "" : draftLine.product_name,
                });
              }}
            >
              <option value="free">Ligne libre</option>
              <option value="product">Produit/service predefini</option>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Article / Service</span>
            <Select
              className="w-72"
              value={draftLine.product_id}
              onChange={(event) => handleProductChange(event.target.value)}
            >
              <option value="">-- Selectionner --</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku ? `[${product.sku}] ` : ""}
                  {product.name} ({product.type === "service" ? "Service" : "Produit"})
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="mb-3 grid gap-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Description / Designation</span>
            <Input
              value={draftLine.description}
              onChange={(event) => setCalculatedDraftLine({ ...draftLine, description: event.target.value })}
              placeholder="Description de la ligne"
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
            <span className="font-medium text-[var(--muted)]">P.U HT</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draftLine.unit_price_ht}
              onChange={(event) => setCalculatedDraftLine({ ...draftLine, unit_price_ht: toNumber(event.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Qte</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draftLine.quantity}
              onChange={(event) => setCalculatedDraftLine({ ...draftLine, quantity: toNumber(event.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Remise %</span>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draftLine.discount_rate}
              onChange={(event) => setCalculatedDraftLine({ ...draftLine, discount_rate: toNumber(event.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">TVA</span>
            <Select value={draftLine.tax_rate_id} onChange={(event) => handleTaxChange(event.target.value)}>
              <option value="">--</option>
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
                <Td className="text-xs text-[var(--muted)]">{index + 1}</Td>
                <Td>{line.product_name || "Ligne libre"}</Td>
                <Td>{line.description}</Td>
                <Td>{line.quantity}</Td>
                <Td>{line.unit_name || "-"}</Td>
                <Td><MoneyDisplay value={line.unit_price_ht} /></Td>
                <Td>{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</Td>
                <Td><MoneyDisplay value={line.subtotal_ht} /></Td>
                <Td>{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</Td>
                <Td><MoneyDisplay value={line.total_ttc} /></Td>
                <Td>
                  <Button type="button" variant="ghost" onClick={() => removeLine(line.id)}>
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
