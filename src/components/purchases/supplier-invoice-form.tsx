"use client";

import Link from "next/link";
import { useActionState, useState, useCallback, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { SupplierCombobox } from "@/components/purchases/supplier-combobox";
import { PurchaseProductCombobox } from "@/components/purchases/purchase-product-combobox";
import { DateField } from "@/components/ui/date-field";
import { createSupplierInvoice, updateSupplierInvoice } from "@/lib/purchase-actions";
import type { SupplierInvoiceLineFormValue, BillableSupplierReceipt, SupplierInvoiceRecord, SupplierInvoiceLineRecord, PurchaseProductOption } from "@/lib/purchase-types";

export function SupplierInvoiceForm({
  suppliers,
  products,
  billableReceipts,
  invoice,
  lines: initialLines,
  prefillSupplierId: prefilledSupplierId,
  prefillSourceReceiptId: prefilledSourceReceiptId,
  prefillLines,
  fullAccess = false,
  taxRates = [],
}: {
  suppliers: { id: string; name: string; ice: string | null }[];
  products: PurchaseProductOption[];
  billableReceipts?: BillableSupplierReceipt[];
  invoice?: SupplierInvoiceRecord | null;
  lines?: SupplierInvoiceLineRecord[];
  prefillSupplierId?: string;
  prefillSourceReceiptId?: string;
  prefillLines?: SupplierInvoiceLineFormValue[];
  fullAccess?: boolean;
  taxRates?: { id: string; rate: number; is_default?: boolean }[];
}) {
  function emptyLine(): SupplierInvoiceLineFormValue {
    const tax = taxRates.find((item) => item.is_default) ?? taxRates.find((item) => Number(item.rate) === 20) ?? taxRates[0];
    return { id: crypto.randomUUID(), mode: "free", product_id: "", product_name: "", description: "", quantity: 1, unit_id: "", unit_name: fullAccess ? "" : "unité", unit_price_ht: 0, discount_rate: 0, tax_rate_id: fullAccess ? "" : tax?.id ?? "", tax_rate: fullAccess ? 0 : Number(tax?.rate ?? 0), subtotal_ht: 0, discount_amount: 0, tax_amount: 0, total_ttc: 0 };
  }
  const isEdit = !!invoice;
  const [supplierId, setSupplierId] = useState(invoice?.supplier_id ?? prefilledSupplierId ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(invoice?.supplier_invoice_number ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [sourceReceiptId, setSourceReceiptId] = useState(invoice?.source_receipt_id ?? prefilledSourceReceiptId ?? "");
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);

  const [lines, setLines] = useState<SupplierInvoiceLineFormValue[]>(() => {
    if (initialLines && initialLines.length > 0) return initialLines.map((l) => ({ id: l.id, mode: "product" as const, product_id: l.product_id ?? "", product_name: l.product_name ?? "", description: l.description, quantity: l.quantity, unit_id: l.unit_id ?? "", unit_name: l.unit_name ?? "", unit_price_ht: l.unit_price_ht, discount_rate: l.discount_rate, tax_rate_id: l.tax_rate_id ?? "", tax_rate: l.tax_rate, subtotal_ht: l.subtotal_ht, discount_amount: l.discount_amount, tax_amount: l.tax_amount, total_ttc: l.total_ttc, source_line_id: l.source_line_id, source_document_id: l.source_document_id }));
    if (prefillLines && prefillLines.length > 0) return prefillLines;
    return fullAccess ? [] : [emptyLine()];
  });

  const action = isEdit ? updateSupplierInvoice : createSupplierInvoice;
  const [state, formAction, pending] = useActionState(action, { success: true });
  const totals = useMemo(() => lines.reduce((sum, line) => {
    const net = Number(line.quantity) * Number(line.unit_price_ht) * (1 - Number(line.discount_rate) / 100);
    const tax = net * Number(line.tax_rate) / 100;
    return { ht: sum.ht + net, tax: sum.tax + tax, ttc: sum.ttc + net + tax };
  }, { ht: 0, tax: 0, ttc: 0 }), [lines]);

  const importReceiptLines = useCallback((receipt: BillableSupplierReceipt) => {
    setLines((prev) => [
      ...prev,
      ...receipt.lines.map((l) => {
        const baseHt = l.quantity * l.unit_price_ht;
        const discountAmount = baseHt * ((l.discount_rate ?? 0) / 100);
        const subtotalHt = baseHt - discountAmount;
        const taxAmount = subtotalHt * ((l.tax_rate ?? 0) / 100);
        return ({
        id: crypto.randomUUID(),
        mode: "product" as const,
        product_id: l.product_id ?? "",
        product_name: l.product_name ?? "",
        description: l.description,
        quantity: l.quantity,
        unit_id: l.unit_id ?? "",
        unit_name: l.unit_name ?? "",
        unit_price_ht: l.unit_price_ht,
        discount_rate: l.discount_rate,
        tax_rate_id: l.tax_rate_id ?? "",
        tax_rate: l.tax_rate,
        subtotal_ht: subtotalHt,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_ttc: subtotalHt + taxAmount,
        source_line_id: l.id,
        source_document_id: receipt.id,
      });
      }),
    ]);
    setSourceReceiptId(receipt.id);
    setShowReceiptsModal(false);
  }, []);

  function addFreeLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  const addProductLine = useCallback((product: PurchaseProductOption) => {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), mode: "product", product_id: product.id, product_name: product.name, description: product.name, quantity: 1, unit_id: product.unit_id ?? "", unit_name: product.unit_name ?? "", unit_price_ht: product.purchase_price_ht, discount_rate: 0, tax_rate_id: product.tax_rate_id ?? "", tax_rate: product.tax_rate_value ?? 0, subtotal_ht: product.purchase_price_ht, discount_amount: 0, tax_amount: (product.tax_rate_value ?? 0) / 100 * product.purchase_price_ht, total_ttc: product.purchase_price_ht + ((product.tax_rate_value ?? 0) / 100 * product.purchase_price_ht) }]);
  }, []);

  const updateLine = useCallback((index: number, field: string, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "tax_rate") next[index].tax_rate_id = "";
      if (["quantity", "unit_price_ht", "discount_rate", "tax_rate"].includes(field)) {
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
    if (isEdit) formData.set("id", invoice!.id);
    formData.set("supplier_id", supplierId);
    formData.set("invoice_date", invoiceDate);
    if (dueDate) formData.set("due_date", dueDate);
    formData.set("supplier_invoice_number", supplierInvoiceNumber);
    if (notes) formData.set("notes", notes);
    if (sourceReceiptId) formData.set("source_receipt_id", sourceReceiptId);
    formData.set("lines", JSON.stringify(lines.map((l) => ({ ...l, unit_id: l.unit_id || null, unit_name: l.unit_name || null, tax_rate_id: l.tax_rate_id || null }))));
    formAction(formData);
  }

  const unInvoicedReceipts = (billableReceipts ?? []).filter((r) => !r.already_invoiced && (!supplierId || r.supplier_id === supplierId));

  return (
    <div className="space-y-6">
      <PageHeader title={isEdit ? "Modifier la facture d’achat" : "Nouvelle facture d’achat"} description={isEdit ? invoice!.invoice_number : fullAccess ? "Créer une facture fournisseur, directement ou depuis une réception." : "Choisissez le fournisseur, puis saisissez les lignes de sa facture."} />

      <form action={handleSubmit}>
        <Card>
          <CardHeader><h2 className="font-semibold">Informations générales</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Fournisseur</label>
              <SupplierCombobox suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
              {suppliers.length === 0 ? <p className="mt-2 text-sm"><Link href="/tiers/new?type=supplier" className="font-medium text-[var(--primary)] underline">Créer mon premier fournisseur</Link></p> : null}
            </div>
            <DateField label="Date de facture" value={invoiceDate} onChange={setInvoiceDate} />
            <DateField label="Échéance" value={dueDate} onChange={setDueDate} placeholder="jj/mm/aaaa" />
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">N° de facture fournisseur <span className="text-red-500">*</span></label>
              <input value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} placeholder="Ex. : FAC-2026-00125" required className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--muted)]">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Lignes</h2>
            <div className="flex flex-wrap gap-2">
              {fullAccess && !isEdit && supplierId ? (
                <Button type="button" variant="secondary" onClick={() => setShowReceiptsModal(true)}>
                  Importer depuis reception
                </Button>
              ) : null}
              {fullAccess ? <PurchaseProductCombobox products={products} onSelect={addProductLine} /> : null}
              <Button type="button" variant="secondary" onClick={addFreeLine}><Plus className="h-4 w-4" /> Ajouter une ligne</Button>
            </div>
          </CardHeader>
          <CardContent>
            {fullAccess && showReceiptsModal && unInvoicedReceipts.length > 0 ? (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold mb-2">Réceptions à facturer</h3>
                {unInvoicedReceipts.map((r) => (
                  <div key={r.id} className="mb-2 flex items-center justify-between rounded border bg-white p-2">
                    <span className="text-sm">{r.document_number} - {r.supplier_name} ({r.lines.length} lignes)</span>
                    <Button type="button" variant="secondary" onClick={() => importReceiptLines(r)}>Importer</Button>
                  </div>
                ))}
              </div>
            ) : null}
            {lines.length === 0 ? (
              <p className="py-4 text-sm text-[var(--muted)]">Ajoutez une ligne pour décrire votre achat.</p>
            ) : (
              <Table>
                <thead><tr>{fullAccess ? <Th>Produit</Th> : null}<Th>Description</Th><Th>Qté</Th>{fullAccess ? <Th>Unité</Th> : null}<Th>Prix HT</Th>{fullAccess ? <Th>Remise %</Th> : null}<Th>Total HT</Th><Th>TVA %</Th><Th>Total TTC</Th><Th></Th></tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={line.id}>
                      {fullAccess ? <Td>{line.product_name || "Ligne libre"}</Td> : null}
                      <Td><input aria-label={`Description de la ligne ${i + 1}`} required value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} className="w-48 rounded border border-input bg-background px-2 py-2 text-sm" /></Td>
                      <Td><input aria-label={`Quantité de la ligne ${i + 1}`} type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className="w-20 rounded border border-input bg-background px-2 py-2 text-sm" /></Td>
                      {fullAccess ? <Td><input value={line.unit_name} onChange={(e) => updateLine(i, "unit_name", e.target.value)} className="w-16 rounded border border-input bg-background px-2 py-1 text-xs" />{!line.unit_name ? <Badge tone="warning">À compléter</Badge> : null}</Td> : null}
                      <Td><input aria-label={`Prix HT de la ligne ${i + 1}`} type="number" min="0.01" step="0.01" value={line.unit_price_ht} onChange={(e) => updateLine(i, "unit_price_ht", e.target.value)} className="w-24 rounded border border-input bg-background px-2 py-2 text-sm" /></Td>
                      {fullAccess ? <Td><input type="number" min="0" max="100" step="0.01" value={line.discount_rate} onChange={(e) => updateLine(i, "discount_rate", e.target.value)} className="w-14 rounded border border-input bg-background px-2 py-1 text-xs" /></Td> : null}
                      <Td className="text-xs">{(Number(line.quantity) * Number(line.unit_price_ht) * (1 - Number(line.discount_rate) / 100)).toFixed(2)}</Td>
                      <Td><input aria-label={`TVA de la ligne ${i + 1}`} type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={(e) => updateLine(i, "tax_rate", e.target.value)} className="w-20 rounded border border-input bg-background px-2 py-2 text-sm" /></Td>
                      <Td className="text-xs">{(line.total_ttc ?? 0).toFixed(2)}</Td>
                      <Td><button type="button" aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
          <CardContent className="flex flex-wrap justify-end gap-4 border-t border-[var(--border)] pt-4 text-sm"><span>Total HT : {totals.ht.toFixed(2)} MAD</span><span>TVA : {totals.tax.toFixed(2)} MAD</span><strong>Total TTC : {totals.ttc.toFixed(2)} MAD</strong></CardContent>
        </Card>

        {!state.success && state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={pending || !supplierId || !supplierInvoiceNumber.trim() || lines.length === 0}>
            {pending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer la facture d’achat"}
          </Button>
          <Button type="button" variant="secondary" asChild><Link href="/achats/factures">Annuler</Link></Button>
        </div>
      </form>
    </div>
  );
}
