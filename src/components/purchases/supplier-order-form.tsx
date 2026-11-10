"use client";

import Link from "next/link";
import { useActionState, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { SupplierCombobox } from "@/components/purchases/supplier-combobox";
import { PurchaseProductCombobox } from "@/components/purchases/purchase-product-combobox";
import { createSupplierOrder, updateSupplierOrder } from "@/lib/purchase-actions";
import { DateField } from "@/components/ui/date-field";
import { quantityDraftError } from "@/lib/invoice-calculations";
import type { PurchaseLineFormValue, PurchaseDocumentRecord, PurchaseDocumentLineRecord, PurchaseProductOption } from "@/lib/purchase-types";

export function SupplierOrderForm({
  suppliers,
  products,
  document,
  lines: initialLines,
}: {
  suppliers: { id: string; name: string; ice: string | null }[];
  products: PurchaseProductOption[];
  document?: PurchaseDocumentRecord | null;
  lines?: PurchaseDocumentLineRecord[];
}) {
  const isEdit = !!document;
  const [supplierId, setSupplierId] = useState(document?.supplier_id ?? "");
  const [documentDate, setDocumentDate] = useState(document?.document_date ?? new Date().toISOString().slice(0, 10));
  const [expectedReceiptDate, setExpectedReceiptDate] = useState(document?.expected_receipt_date ?? "");
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(document?.internal_notes ?? "");
  const [lineError, setLineError] = useState<string | null>(null);
  const [qtyText, setQtyText] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<PurchaseLineFormValue[]>(() => {
    if (initialLines && initialLines.length > 0) return initialLines.map((l) => ({ id: l.id, mode: "product" as const, product_id: l.product_id ?? "", product_name: l.product_name ?? "", description: l.description, quantity: l.quantity, unit_id: l.unit_id ?? "", unit_name: l.unit_name ?? "", unit_price_ht: l.unit_price_ht, discount_rate: l.discount_rate, tax_rate_id: l.tax_rate_id ?? "", tax_rate: l.tax_rate, subtotal_ht: l.subtotal_ht, discount_amount: l.discount_amount, tax_amount: l.tax_amount, total_ttc: l.total_ttc }));
    return [];
  });

  const action = isEdit ? updateSupplierOrder : createSupplierOrder;
  const [state, formAction, pending] = useActionState(action, { success: true });

  const addFreeLine = useCallback(() => {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), mode: "free", product_id: "", product_name: "", description: "", quantity: 1, unit_id: "", unit_name: "", unit_price_ht: 0, discount_rate: 0, tax_rate_id: "", tax_rate: 0, subtotal_ht: 0, discount_amount: 0, tax_amount: 0, total_ttc: 0 }]);
  }, []);

  const addProductLine = useCallback((product: PurchaseProductOption) => {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), mode: "product", product_id: product.id, product_name: product.name, description: product.name, quantity: 1, unit_id: product.unit_id ?? "", unit_name: product.unit_name ?? "", unit_price_ht: product.purchase_price_ht, discount_rate: 0, tax_rate_id: product.tax_rate_id ?? "", tax_rate: product.tax_rate_value ?? 0, subtotal_ht: product.purchase_price_ht, discount_amount: 0, tax_amount: (product.tax_rate_value ?? 0) / 100 * product.purchase_price_ht, total_ttc: product.purchase_price_ht + ((product.tax_rate_value ?? 0) / 100 * product.purchase_price_ht) }]);
  }, []);

  const updateLine = useCallback((index: number, field: keyof PurchaseLineFormValue, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "quantity" || field === "unit_price_ht" || field === "discount_rate" || field === "tax_rate") {
        const qty = field === "quantity" ? Number(value) : next[index].quantity;
        const price = field === "unit_price_ht" ? Number(value) : next[index].unit_price_ht;
        const disc = field === "discount_rate" ? Number(value) : next[index].discount_rate;
        const tax = field === "tax_rate" ? Number(value) : next[index].tax_rate;
        next[index].subtotal_ht = qty * price;
        next[index].discount_amount = next[index].subtotal_ht * (disc / 100);
        next[index].tax_amount = (next[index].subtotal_ht - next[index].discount_amount) * (tax / 100);
        next[index].total_ttc = next[index].subtotal_ht - next[index].discount_amount + next[index].tax_amount;
      }
      return next;
    });
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }, []);

  function handleSubmit(formData: FormData) {
    if (lines.some((line) => Number(line.quantity) < 0) || Object.values(qtyText).some((value) => quantityDraftError(value))) {
      setLineError("La quantité ne peut pas être négative.");
      return;
    }
    setLineError(null);
    if (isEdit) { formData.set("id", document!.id); formData.set("expected_updated_at", document!.updated_at); }
    formData.set("supplier_id", supplierId);
    formData.set("document_date", documentDate);
    if (expectedReceiptDate) formData.set("expected_receipt_date", expectedReceiptDate);
    if (notes) formData.set("notes", notes);
    if (internalNotes) formData.set("internal_notes", internalNotes);
    formData.set("lines", JSON.stringify(lines.map((l) => ({ ...l, unit_id: l.unit_id || null, unit_name: l.unit_name || null, tax_rate_id: l.tax_rate_id || null }))));
    formAction(formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Modifier la commande fournisseur" : "Nouvelle commande fournisseur"}
        description={isEdit ? document!.document_number : "Saisir une commande fournisseur"}
      />

      <form action={handleSubmit} className="erp-form">
        <Card>
          <CardHeader><h2 className="font-semibold">Fournisseur et dates</h2><p className="mt-1 text-sm text-[var(--muted)]">Les informations principales de votre commande d’achat.</p></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Fournisseur</label>
              <SupplierCombobox suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
            </div>
            <DateField label="Date de commande" value={documentDate} onChange={setDocumentDate} />
            <DateField label="Réception prévue" value={expectedReceiptDate} onChange={setExpectedReceiptDate} placeholder="jj/mm/aaaa" />
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Notes</label>
              <textarea aria-label="Notes sur la commande" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Notes internes</label>
              <textarea aria-label="Notes internes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </CardContent>
        </Card>

        <Card className="erp-form-lines mt-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-semibold">Lignes de commande</h2>
            <div className="flex flex-wrap gap-2">
              <PurchaseProductCombobox products={products} onSelect={addProductLine} />
              <Button type="button" variant="ghost" onClick={addFreeLine}><Plus className="h-4 w-4" /> Ligne libre</Button>
            </div>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="py-4 text-sm text-[var(--muted)]">Ajoutez des articles ou une ligne libre.</p>
            ) : (
              <Table>
                <thead><tr><Th>Produit</Th><Th>Description</Th><Th>Qté</Th><Th>Unité</Th><Th>Prix HT</Th><Th>Remise %</Th><Th>Total HT</Th><Th>TVA %</Th><Th>Total TTC</Th><Th></Th></tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.id}>
                      <Td>{line.product_name || "Ligne libre"}</Td>
                      <Td><input aria-label={`Description de la ligne ${i + 1}`} value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} className="w-32 rounded border border-input bg-background px-2 py-1 text-xs" /></Td>
                      <Td><input aria-label={`Quantité de la ligne ${i + 1}`} type="text" inputMode="decimal" value={qtyText[line.id] ?? String(line.quantity)} onChange={(e) => { const raw = e.target.value; setQtyText((prev) => ({ ...prev, [line.id]: raw })); if (quantityDraftError(raw)) { setLineError("La quantité ne peut pas être négative."); return; } setLineError(null); if (raw.trim() === "" || raw.endsWith(".") || raw.endsWith(",")) return; updateLine(i, "quantity", Number(raw.replace(",", "."))); }} className="w-16 rounded border border-input bg-background px-2 py-1 text-xs" /></Td>
                      <Td><input aria-label={`Unité de la ligne ${i + 1}`} value={line.unit_name} onChange={(e) => updateLine(i, "unit_name", e.target.value)} className="w-16 rounded border border-input bg-background px-2 py-1 text-xs" /></Td>
                      <Td><input aria-label={`Prix HT de la ligne ${i + 1}`} type="number" step="0.01" value={line.unit_price_ht} onChange={(e) => updateLine(i, "unit_price_ht", e.target.value)} className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" /></Td>
                      <Td><input aria-label={`Remise de la ligne ${i + 1}`} type="number" step="0.01" value={line.discount_rate} onChange={(e) => updateLine(i, "discount_rate", e.target.value)} className="w-14 rounded border border-input bg-background px-2 py-1 text-xs" /></Td>
                      <Td className="text-xs">{(line.subtotal_ht ?? 0).toFixed(2)}</Td>
                      <Td><input aria-label={`TVA de la ligne ${i + 1}`} type="number" step="0.01" value={line.tax_rate} onChange={(e) => updateLine(i, "tax_rate", e.target.value)} className="w-14 rounded border border-input bg-background px-2 py-1 text-xs" /></Td>
                      <Td className="text-xs">{(line.total_ttc ?? 0).toFixed(2)}</Td>
                      <Td><button type="button" aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        {lineError ? <p role="alert" className="mt-2 text-sm text-red-600">{lineError}</p> : null}
        {!state.success && state.error ? (
          <p role="alert" className="mt-2 text-sm text-red-600">{state.error}</p>
        ) : null}

        <div className="erp-form-actions mt-6 flex gap-3">
          <Button type="button" variant="secondary" asChild><Link href={document ? `/achats/commandes/${document.id}` : "/achats/commandes"}>Annuler</Link></Button>
          <Button type="submit" disabled={pending}>
            {isEdit ? "Enregistrer les modifications" : "Créer la commande fournisseur"}
          </Button>
        </div>
      </form>
    </div>
  );
}
