"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ProductActionResult } from "@/lib/product-actions";
import type { ProductCategory, ProductRecord, ProductType, TaxRate, Unit } from "@/lib/product-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  mode: "create" | "edit";
  product?: ProductRecord;
  categories: ProductCategory[];
  units: Unit[];
  taxRates: TaxRate[];
  action: (state: ProductActionResult, formData: FormData) => Promise<ProductActionResult>;
  initialType?: ProductType;
};

const initialState: ProductActionResult = { success: true };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function ProductForm({ mode, product, categories, units, taxRates, action, initialType }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [type, setType] = useState<ProductType>(initialType ?? (product?.type as ProductType) ?? "product");
  const [taxRateId, setTaxRateId] = useState(() => product?.tax_rate_id ?? taxRates.find((t) => t.is_default)?.id ?? "");
  const [purchasePrice, setPurchasePrice] = useState(product?.purchase_price_ht ?? 0);
  const [salePrice, setSalePrice] = useState(product?.sale_price_ht ?? 0);

  const selectedTaxRate = useMemo(
    () => taxRates.find((t) => t.id === taxRateId),
    [taxRateId, taxRates],
  );

  const salePriceTtc = salePrice * (1 + (selectedTaxRate?.rate ?? 0) / 100);
  const marginAmount = salePrice - purchasePrice;
  const marginRate = salePrice > 0 ? (marginAmount / salePrice) * 100 : 0;

  return (
    <form action={formAction} className="space-y-5">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="Type *">
            <Select name="type" value={type} onChange={(e) => setType(e.target.value as ProductType)}>
              <option value="product">Produit</option>
              <option value="service">Service</option>
            </Select>
          </Field>
          <Field label="Reference interne (SKU)">
            <Input name="sku" defaultValue={product?.sku ?? ""} placeholder="Optionnel" />
          </Field>
          <Field label="Code-barres">
            <Input name="barcode" defaultValue={product?.barcode ?? ""} placeholder="Optionnel" />
          </Field>
          <Field label="Nom *">
            <Input name="name" defaultValue={product?.name ?? ""} required />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={product?.description ?? ""} />
          </Field>
          <Field label="Categorie">
            <Select name="category_id" defaultValue={product?.category_id ?? ""}>
              <option value="">Sélectionner une categorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Unite">
            <Select name="unit_id" defaultValue={product?.unit_id ?? ""}>
              <option value="">Selectionner une unite</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
              ))}
            </Select>
          </Field>
          <Field label="Statut">
            <Select name="status" defaultValue={product?.status ?? "active"}>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Prix & TVA</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          <Field label="Prix d'achat HT">
            <Input
              name="purchase_price_ht"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Number(e.target.value))}
            />
          </Field>
          <Field label="Prix de vente HT">
            <Input
              name="sale_price_ht"
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(Number(e.target.value))}
            />
          </Field>
          <Field label="TVA">
            <Select name="tax_rate_id" value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)}>
              <option value="">Sélectionner</option>
              {taxRates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
              ))}
            </Select>
          </Field>
          <Field label="Prix vente TTC">
            <Input value={salePriceTtc.toFixed(2)} disabled readOnly />
          </Field>
          <Field label="Marge estimee">
            <Input
              value={`${marginAmount.toFixed(2)} MAD`}
              disabled
              readOnly
              className={marginAmount >= 0 ? "" : "text-red-600"}
            />
          </Field>
          <Field label="Taux de marge">
            <Input
              value={`${marginRate.toFixed(1)}%`}
              disabled
              readOnly
              className={marginRate >= 0 ? "" : "text-red-600"}
            />
          </Field>
        </CardContent>
      </Card>

      {type === "product" ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Stock</h2></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-4">
            <label className="flex items-center gap-2 self-end rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
              <input name="track_stock" type="checkbox" defaultChecked={product?.track_stock ?? false} />
              Suivre le stock
            </label>
            <Field label="Stock actuel">
              <Input name="current_stock" type="number" min="0" step="1" defaultValue={product?.current_stock ?? 0} />
            </Field>
            <Field label="Stock minimum">
              <Input name="min_stock" type="number" min="0" step="1" defaultValue={product?.min_stock ?? 0} />
            </Field>
            <label className="flex items-center gap-2 self-end rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
              <input name="stock_alert_enabled" type="checkbox" defaultChecked={product?.stock_alert_enabled ?? false} />
              Alerte stock bas
            </label>
          </CardContent>
        </Card>
      ) : (
        <>
          <input type="hidden" name="track_stock" value="off" />
          <input type="hidden" name="current_stock" value="0" />
          <input type="hidden" name="min_stock" value="0" />
          <input type="hidden" name="stock_alert_enabled" value="off" />
          <Card>
            <CardContent className="py-4 text-sm text-[var(--muted)]">
              Le stock ne s&apos;applique pas aux services.
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold">Options commerciales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <input name="is_sellable" type="checkbox" defaultChecked={product?.is_sellable ?? true} />
            Vendable
          </label>
          <label className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <input name="is_purchasable" type="checkbox" defaultChecked={product?.is_purchasable ?? true} />
            Achetable
          </label>
          <Field label="Remise par defaut (%)">
            <Input name="default_discount_rate" type="number" min="0" max="100" step="0.01" defaultValue={product?.default_discount_rate ?? 0} />
          </Field>
          <Field label="Notes internes">
            <Textarea name="notes" defaultValue={product?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--background)] py-4">
        <Link href={product ? `/articles/${product.id}` : "/articles"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
        <Button disabled={pending}>
          {mode === "create" ? (type === "product" ? "Creer produit" : "Creer service") : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
