"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StockProductCombobox } from "@/components/stock/stock-product-combobox";
import type { StockActionResult } from "@/lib/stock-types";
import type { StockProductOption, WarehouseOption } from "@/lib/stock-types";

type Props = {
  mode: "entry" | "adjustment";
  products: StockProductOption[];
  warehouses: WarehouseOption[];
  initialProductId?: string;
  action: (state: StockActionResult, formData: FormData) => Promise<StockActionResult>;
};

const initialState: StockActionResult = { success: true };

function today() {
  return new Date().toISOString().split("T")[0];
}

export function StockOperationForm({ mode, products, warehouses, initialProductId, action }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [productId, setProductId] = useState(initialProductId ?? "");
  const toasted = useRef(false);
  const defaultWarehouseId = warehouses.find((warehouse) => warehouse.is_default)?.id ?? warehouses[0]?.id ?? "";
  const [quantity, setQuantity] = useState("1");
  const [qtyError, setQtyError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const isUnitU = selectedProduct?.unit_symbol?.trim().toUpperCase() === "U";

  function handleProductSelect(id: string) {
    setProductId(id);
    const nextProduct = products.find((p) => p.id === id);
    const nextIsUnitU = nextProduct?.unit_symbol?.trim().toUpperCase() === "U";
    if (nextIsUnitU) {
      const num = Number(quantity);
      if (!Number.isInteger(num)) {
        setQuantity(String(Math.floor(num) || 1));
      }
      setQtyError(null);
    } else {
      setQtyError(null);
    }
  }

  function handleQuantityChange(value: string) {
    setQuantity(value);
    if (isUnitU && value.includes(".")) {
      setQtyError("La quantité doit etre un nombre entier pour l'unite U.");
    } else {
      setQtyError(null);
    }
  }

  useEffect(() => {
    if (pending) toasted.current = false;
    const message = (state.data as { message?: string } | undefined)?.message;
    if (!pending && state.success && message && !toasted.current) {
      toasted.current = true;
      toast.success(message);
      router.refresh();
    }
  }, [pending, state, router]);

  function handleSubmit(formData: FormData) {
    idempotencyKeyRef.current ??= globalThis.crypto.randomUUID();
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="product_id" value={productId} />
      <Card>
        <CardHeader>
          <h2 className="font-semibold">{mode === "entry" ? "Entrée manuelle" : "Ajustement stock"}</h2>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Article</span>
            <StockProductCombobox
              products={products}
              value={productId}
              onSelect={handleProductSelect}
              pushUrl={false}
            />
            {selectedProduct ? (
              <p className="text-xs text-[var(--muted)]">
                Stock actuel : {selectedProduct.current_stock} {selectedProduct.unit_symbol ?? ""}
              </p>
            ) : null}
          </div>

          {mode === "adjustment" ? (
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)]">Type d&apos;ajustement</span>
              <Select name="direction" defaultValue="in">
                <option value="in">Entrée / correction positive</option>
                <option value="out">Sortie / correction negative</option>
              </Select>
            </label>
          ) : null}

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Emplacement de stock</span>
            <Select name="warehouse_id" defaultValue={defaultWarehouseId}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </Select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Quantité</span>
            <Input
              name="quantity"
              type="number"
              min={isUnitU ? "1" : "0.001"}
              step={isUnitU ? "1" : "0.001"}
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              required
            />
            {qtyError ? (
              <p className="text-xs text-red-600">{qtyError}</p>
            ) : null}
          </label>

          {mode === "entry" ? (
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--foreground)]">Coût unitaire HT</span>
              <Input name="unit_cost" type="number" min="0" step="0.01" placeholder="Optionnel, pour le CMUP" />
            </label>
          ) : null}

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Date</span>
            <DateField name="movement_date" defaultValue={today()} required />
          </label>

          <label className="space-y-2 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--foreground)]">{mode === "adjustment" ? "Motif" : "Note / motif"}</span>
            <Textarea name={mode === "adjustment" ? "reason" : "notes"} required={mode === "adjustment"} />
          </label>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href={productId ? `/stock/mouvements?productId=${productId}` : "/stock/mouvements"}>Annuler</Link></Button>
        <Button disabled={pending || !productId}>{mode === "entry" ? "Valider entree" : "Valider ajustement"}</Button>
      </div>
    </form>
  );
}
