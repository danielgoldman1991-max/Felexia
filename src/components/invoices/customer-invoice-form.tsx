"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { BillableDeliveryNotesModal } from "@/components/invoices/billable-delivery-notes-modal";
import { CustomerCombobox } from "@/components/sales/customer-combobox";
import { InvoiceLinesEditor } from "@/components/invoices/invoice-lines-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { listBillableDeliveryNotesForInvoice, prepareInvoiceLinesFromDeliveryNotes } from "@/lib/invoice-actions";
import { PAYMENT_TERMS_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import { calculateDueDate } from "@/lib/payment-terms";
import type { BillableDeliveryOption, InvoiceActionResult, InvoiceCustomerOption, InvoiceLineFormValue, InvoiceProductOption } from "@/lib/invoice-types";
import type { TaxRateForSalesSelect, UnitForSalesSelect } from "@/lib/sales-types";

type Props = {
  action: (state: InvoiceActionResult, formData: FormData) => Promise<InvoiceActionResult>;
  customers: InvoiceCustomerOption[];
  products: InvoiceProductOption[];
  units: UnitForSalesSelect[];
  taxRates: TaxRateForSalesSelect[];
  initialCustomerId?: string;
  initialLines?: InvoiceLineFormValue[];
  initialDeliveryNotes?: BillableDeliveryOption[];
  initialSelectedDeliveryNoteIds?: string[];
  initialInvoiceDate?: string;
  initialDueDate?: string | null;
  initialPaymentTermsDays?: number;
  initialPaymentTerms?: string | null;
  initialPaymentMethod?: string | null;
  initialCustomPaymentTerms?: string | null;
  initialCustomPaymentMethod?: string | null;
  initialNotes?: string | null;
  initialInternalNotes?: string | null;
  sourceType?: string;
  sourceDocumentId?: string;
  sourceOrderId?: string;
  sourceDeliveryId?: string;
  submitLabel?: string;
  cancelHref?: string;
  invoiceId?: string;
};

function today() {
  return new Date().toISOString().split("T")[0];
}

export function CustomerInvoiceForm({
  action,
  customers,
  products,
  units,
  taxRates,
  initialCustomerId = "",
  initialLines = [],
  initialDeliveryNotes = [],
  initialSelectedDeliveryNoteIds = [],
  initialInvoiceDate = today(),
  initialDueDate = "",
  initialPaymentTermsDays = 0,
  initialPaymentTerms = "",
  initialPaymentMethod = "",
  initialCustomPaymentTerms = "",
  initialCustomPaymentMethod = "",
  initialNotes = "",
  initialInternalNotes = "",
  sourceType = "manual",
  sourceDocumentId = "",
  sourceOrderId = "",
  sourceDeliveryId = "",
  submitLabel = "Creer facture",
  cancelHref = "/facturation/factures",
  invoiceId,
}: Props) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const initialCustomerData = customers.find((c) => c.id === initialCustomerId);
  const [paymentTerms, setPaymentTerms] = useState(
    initialPaymentTerms || initialCustomerData?.payment_terms || "",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialPaymentMethod || initialCustomerData?.payment_method || "",
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    initialPaymentTermsDays ?? initialCustomerData?.payment_terms_days ?? 0,
  );
  const [customPaymentTerms, setCustomPaymentTerms] = useState(
    initialCustomPaymentTerms ?? initialCustomerData?.custom_payment_terms ?? "",
  );
  const [customPaymentMethod, setCustomPaymentMethod] = useState(
    initialCustomPaymentMethod ?? initialCustomerData?.custom_payment_method ?? "",
  );
  const initialDue = initialDueDate
    ?? (initialCustomerData?.payment_terms ? calculateDueDate(initialInvoiceDate, initialCustomerData.payment_terms) : null)
    ?? "";
  const [dueDate, setDueDate] = useState(initialDue);
  const [lines, setLines] = useState<InvoiceLineFormValue[]>(initialLines);
  const [deliveryNotes, setDeliveryNotes] = useState<BillableDeliveryOption[]>(initialDeliveryNotes);
  const [selectedDeliveryNoteIds, setSelectedDeliveryNoteIds] = useState<string[]>(initialSelectedDeliveryNoteIds);
  const [modalOpen, setModalOpen] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [isLoadingDeliveries, startDeliveryTransition] = useTransition();
  const totals = useMemo(() => calculateInvoiceTotals(lines), [lines]);
  const selectedDeliveryNotes = useMemo(
    () => deliveryNotes.filter((delivery) => selectedDeliveryNoteIds.includes(delivery.id)),
    [deliveryNotes, selectedDeliveryNoteIds],
  );
  const effectiveSourceType = selectedDeliveryNoteIds.length > 1
    ? "grouped_delivery_notes"
    : selectedDeliveryNoteIds.length === 1
      ? "delivery_note"
      : sourceType;
  const effectiveSourceDeliveryId = selectedDeliveryNoteIds.length === 1 ? selectedDeliveryNoteIds[0] : sourceDeliveryId;
  const effectiveSourceDocumentId = selectedDeliveryNoteIds.length === 1 ? selectedDeliveryNoteIds[0] : sourceDocumentId;

  function handleCustomerChange(nextCustomerId: string) {
    if (nextCustomerId === customerId) return;
    if (lines.length > 0) {
      const confirmed = window.confirm("Changer de client supprimera les lignes deja importees. Continuer ?");
      if (!confirmed) return;
    }
    setCustomerId(nextCustomerId);
    setLines([]);
    setSelectedDeliveryNoteIds([]);
    setDeliveryNotes([]);
    setDeliveryError(null);
    const customer = customers.find((c) => c.id === nextCustomerId);
    if (customer) {
      setPaymentTerms(customer.payment_terms ?? "");
      setPaymentMethod(customer.payment_method ?? "");
      setPaymentTermsDays(customer.payment_terms_days ?? 0);
      setCustomPaymentTerms(customer.custom_payment_terms ?? "");
      setCustomPaymentMethod(customer.custom_payment_method ?? "");
      const invoiceDate = (document.querySelector<HTMLInputElement>("input[name='invoice_date']")?.value) ?? new Date().toISOString().split("T")[0];
      const calculatedDueDate = calculateDueDate(invoiceDate, customer.payment_terms);
      if (calculatedDueDate) setDueDate(calculatedDueDate);
    }
  }

  function openDeliveryNotesModal() {
    if (!customerId) {
      setDeliveryError("Selectionnez d'abord un client.");
      return;
    }
    setDeliveryError(null);
    startDeliveryTransition(async () => {
      const result = await listBillableDeliveryNotesForInvoice(customerId);
      if (!result.success) {
        setDeliveryError(result.error ?? "Impossible de charger les bons de livraison.");
        return;
      }
      const payload = result.data as { deliveryNotes?: BillableDeliveryOption[] } | undefined;
      setDeliveryNotes(payload?.deliveryNotes ?? []);
      setModalOpen(true);
    });
  }

  function importDeliveryNotes(ids: string[]) {
    if (!customerId || ids.length === 0) return;
    setDeliveryError(null);
    startDeliveryTransition(async () => {
      const result = await prepareInvoiceLinesFromDeliveryNotes(customerId, ids);
      if (!result.success) {
        setDeliveryError(result.error ?? "Impossible d'importer les bons de livraison.");
        return;
      }
      const payload = result.data as { lines?: InvoiceLineFormValue[]; deliveryNotes?: BillableDeliveryOption[] } | undefined;
      setSelectedDeliveryNoteIds(ids);
      setLines(payload?.lines ?? []);
      if (payload?.deliveryNotes?.length) setDeliveryNotes(payload.deliveryNotes);
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      {invoiceId ? <input type="hidden" name="id" value={invoiceId} /> : null}
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="selected_delivery_note_ids" value={JSON.stringify(selectedDeliveryNoteIds)} />
      <input type="hidden" name="source_type" value={effectiveSourceType} />
      <input type="hidden" name="source_document_id" value={effectiveSourceDocumentId} />
      <input type="hidden" name="source_order_id" value={sourceOrderId} />
      <input type="hidden" name="source_delivery_id" value={effectiveSourceDeliveryId} />
      <input type="hidden" name="payment_terms" value={paymentTerms} />
      <input type="hidden" name="payment_method" value={paymentMethod} />
      <input type="hidden" name="payment_terms_days" value={paymentTermsDays} />
      <input type="hidden" name="custom_payment_terms" value={customPaymentTerms} />
      <input type="hidden" name="custom_payment_method" value={customPaymentMethod} />

      <Card>
        <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Client *</span>
            <CustomerCombobox customers={customers} value={customerId} onChange={handleCustomerChange} placeholder="Rechercher un client..." />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Date facture</span>
            <DateField name="invoice_date" defaultValue={initialInvoiceDate} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Date echeance</span>
            <DateField name="due_date" value={dueDate} onChange={(iso) => setDueDate(iso)} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Conditions de paiement</span>
            <select
              value={paymentTerms}
              onChange={(e) => {
                const value = e.target.value;
                setPaymentTerms(value);
                const invoiceDateInput = document.querySelector<HTMLInputElement>("input[name='invoice_date']");
                const invoiceDate = invoiceDateInput?.value ?? new Date().toISOString().split("T")[0];
                const newDueDate = calculateDueDate(invoiceDate, value);
                if (newDueDate) setDueDate(newDueDate);
              }}
              className="flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            >
              <option value="">-- Selectionner --</option>
              {PAYMENT_TERMS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Modalites de paiement</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="flex h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
            >
              <option value="">-- Selectionner --</option>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {paymentTerms === "custom" ? (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-[var(--muted)]">Detail condition personnalisee</span>
              <Input name="custom_payment_terms" value={customPaymentTerms} onChange={(e) => setCustomPaymentTerms(e.target.value)} placeholder="Decrivez la condition..." />
            </label>
          ) : null}
          {paymentMethod === "other" ? (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-[var(--muted)]">Detail modalite personnalisee</span>
              <Input name="custom_payment_method" value={customPaymentMethod} onChange={(e) => setCustomPaymentMethod(e.target.value)} placeholder="Decrivez la modalite..." />
            </label>
          ) : null}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm">
            <p className="font-medium">Total TTC</p>
            <p className="mt-1 text-lg font-semibold text-[var(--secondary)]">{totals.total_ttc.toLocaleString("fr-MA", { style: "currency", currency: "MAD" })}</p>
          </div>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Notes client</span>
            <Textarea name="notes" rows={3} defaultValue={initialNotes ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Notes internes</span>
            <Textarea name="internal_notes" rows={3} defaultValue={initialInternalNotes ?? ""} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Bons de livraison a facturer</h2></CardHeader>
        <CardContent className="space-y-4">
          {!customerId ? (
            <p className="text-sm text-[var(--muted)]">Selectionnez d&apos;abord un client pour voir ses bons de livraison.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={openDeliveryNotesModal} disabled={isLoadingDeliveries}>
                <FileText className="h-4 w-4" />
                {isLoadingDeliveries ? "Chargement..." : "Selectionner des BL a facturer"}
              </Button>
              {selectedDeliveryNotes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedDeliveryNotes.map((delivery) => (
                    <Badge key={delivery.id} tone="info">
                      {delivery.document_number} - {delivery.lines_count ?? 0} lignes
                    </Badge>
                  ))}
                </div>
              ) : (
              <span className="text-sm text-[var(--muted)]">Aucun BL selectionne.</span>
            )}
          </div>
          )}
          {deliveryError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{deliveryError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Lignes facture</h2></CardHeader>
        <CardContent>
          <InvoiceLinesEditor lines={lines} onChange={setLines} products={products} units={units} taxRates={taxRates} />
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href={cancelHref}>Annuler</Link></Button>
        <Button disabled={pending}>{submitLabel}</Button>
      </div>

      <BillableDeliveryNotesModal
        key={modalOpen ? selectedDeliveryNoteIds.join("|") || "new-selection" : "closed"}
        open={modalOpen}
        onOpenChange={setModalOpen}
        deliveryNotes={deliveryNotes}
        selectedIds={selectedDeliveryNoteIds}
        onConfirm={importDeliveryNotes}
      />
    </form>
  );
}
