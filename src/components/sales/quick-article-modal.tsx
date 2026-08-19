"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductCategory, TaxRate, Unit } from "@/lib/product-types";
import { quickCreateProduct } from "@/lib/actions/quick-create";

type QuickArticleModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (productId: string, productName: string, unitId: string, unitName: string, salePriceHt: number, taxRateId: string, taxRateValue: number) => void;
  categories: ProductCategory[];
  units: Unit[];
  taxRates: TaxRate[];
};

export function QuickArticleModal({ open, onClose, onCreated, categories, units, taxRates }: QuickArticleModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"product" | "service">("product");
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [salePriceHt, setSalePriceHt] = useState(0);
  const [taxRateId, setTaxRateId] = useState(taxRates.find((t) => t.is_default)?.id ?? taxRates.find((t) => Number(t.rate) === 20)?.id ?? taxRates[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("type", type);
    formData.set("category_id", categoryId);
    formData.set("unit_id", unitId);
    formData.set("tax_rate_id", taxRateId);
    formData.set("sale_price_ht", String(salePriceHt));
    formData.set("purchase_price_ht", "0");
    formData.set("description", description);
    formData.set("default_discount_rate", "0");
    formData.set("status", "active");
    formData.set("is_sellable", "on");
    formData.set("is_purchasable", "on");
    if (type === "service") {
      formData.set("track_stock", "off");
    }

    const result = await quickCreateProduct(formData);
    if (!result.success) {
      setError(result.error ?? "Erreur lors de la creation");
      setSaving(false);
      return;
    }

    const selectedUnit = units.find((u) => u.id === unitId);
    const selectedTax = taxRates.find((t) => t.id === taxRateId);

    onCreated(
      result.data?.id ?? "",
      name.trim(),
      unitId,
      selectedUnit?.symbol ?? selectedUnit?.name ?? "",
      salePriceHt,
      taxRateId,
      selectedTax?.rate ?? 0,
    );
    setSaving(false);
    handleClose();
  }

  function handleClose() {
    setName("");
    setType("product");
    setCategoryId("");
    setUnitId("");
    setSalePriceHt(0);
    setTaxRateId(taxRates.find((t) => t.is_default)?.id ?? taxRates.find((t) => Number(t.rate) === 20)?.id ?? taxRates[0]?.id ?? "");
    setDescription("");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold">Nouvel article rapide</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value as "product" | "service")}>
              <option value="product">Produit</option>
              <option value="service">Service</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Nom *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'article" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Categorie</label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">--</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Unite</label>
              <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">--</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.symbol}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Prix vente HT</label>
              <Input type="number" min="0" step="0.01" value={salePriceHt} onChange={(e) => setSalePriceHt(Number(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">TVA</label>
              <Select value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)}>
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Description (optionnelle)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose}>Annuler</Button>
          <Button type="button" onClick={handleCreate} disabled={saving}>
            {saving ? "Creation..." : "Creer l'article"}
          </Button>
        </div>
      </div>
    </div>
  );
}
