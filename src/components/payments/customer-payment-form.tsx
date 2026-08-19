"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { CustomerCombobox } from "@/components/sales/customer-combobox";
import { CustomerOpenItems } from "@/components/payments/customer-open-items";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCustomerOpenItemsAction } from "@/lib/payment-actions";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import { CUSTOMER_PAYMENT_TYPE_LABELS, type CustomerOpenItems as CustomerOpenItemsType, type OpenInvoiceForAllocation, type PaymentActionResult } from "@/lib/payment-types";
import type { InvoiceCustomerOption } from "@/lib/invoice-types";
import type { TreasuryAccountRecord } from "@/lib/treasury-types";

type Props = {
  action: (state: PaymentActionResult, formData: FormData) => Promise<PaymentActionResult>;
  customers: InvoiceCustomerOption[];
  treasuryAccounts?: TreasuryAccountRecord[];
  invoices?: OpenInvoiceForAllocation[];
  initialOpenItems?: CustomerOpenItemsType | null;
  initialCustomerId?: string;
  initialInvoiceId?: string;
  initialAmount?: number;
  submitLabel?: string;
  cancelHref?: string;
  paymentId?: string;
  initialValues?: {
    payment_date?: string;
    value_date?: string | null;
    amount?: number;
    payment_method?: string;
    payment_type?: string;
    reference?: string | null;
    bank_name?: string | null;
    check_number?: string | null;
    transfer_reference?: string | null;
    due_date?: string | null;
    notes?: string | null;
    internal_notes?: string | null;
  };
};

const paymentTypes = Object.entries(CUSTOMER_PAYMENT_TYPE_LABELS);

function today() {
  return new Date().toISOString().split("T")[0];
}

function openItemsFromInvoices(invoices: OpenInvoiceForAllocation[]): CustomerOpenItemsType | null {
  if (invoices.length === 0) return null;
  const todayIso = new Date().toISOString().split("T")[0];
  const rows = invoices.map((invoice) => ({
    ...invoice,
    is_overdue: Boolean(invoice.due_date && invoice.due_date < todayIso),
  }));
  const totalRemaining = rows.reduce((sum, invoice) => sum + invoice.remaining_amount, 0);
  const overdueAmount = rows.filter((invoice) => invoice.is_overdue).reduce((sum, invoice) => sum + invoice.remaining_amount, 0);
  return {
    customer: null,
    invoices: rows,
    credits: [],
    summary: {
      total_open_invoices: totalRemaining,
      overdue_amount: overdueAmount,
      total_remaining_amount: totalRemaining,
      invoices_count: rows.length,
    },
  };
}

export function CustomerPaymentForm({
  action,
  customers,
  treasuryAccounts = [],
  invoices = [],
  initialOpenItems = null,
  initialCustomerId = "",
  initialInvoiceId = "",
  initialAmount = 0,
  submitLabel = "Creer paiement",
  cancelHref = "/facturation/paiements",
  paymentId,
  initialValues,
}: Props) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  const [isLoadingOpenItems, startOpenItemsTransition] = useTransition();
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [amount, setAmount] = useState(initialValues?.amount ?? initialAmount);
  const [allocations, setAllocations] = useState<Record<string, number>>(() => initialInvoiceId ? { [initialInvoiceId]: initialAmount } : {});
  const [openItems, setOpenItems] = useState<CustomerOpenItemsType | null>(initialOpenItems ?? openItemsFromInvoices(invoices));
  const [openItemsError, setOpenItemsError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const allocationRows = useMemo(
    () => Object.entries(allocations).map(([invoice_id, value]) => ({ invoice_id, amount: Number(value || 0) })).filter((row) => row.amount > 0),
    [allocations],
  );
  const allocatedTotal = allocationRows.reduce((sum, row) => sum + row.amount, 0);

  function handleCustomerChange(value: string) {
    setCustomerId(value);
    setAllocations({});
    setOpenItemsError(null);
    if (!value) {
      setOpenItems(null);
      return;
    }
    startOpenItemsTransition(() => {
      void getCustomerOpenItemsAction(value).then((result) => {
        if (!result.success) {
          setOpenItems(null);
          setOpenItemsError(result.error ?? "Impossible de charger les echeances du client.");
          return;
        }
        setOpenItems(result.data as CustomerOpenItemsType);
      });
    });
  }

  function handleSubmit(formData: FormData) {
    idempotencyKeyRef.current ??= globalThis.crypto.randomUUID();
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {paymentId ? <input type="hidden" name="id" value={paymentId} /> : null}
      <input type="hidden" name="third_party_id" value={customerId} />
      <input type="hidden" name="source_type" value={initialInvoiceId ? "invoice" : "manual"} />
      <input type="hidden" name="source_invoice_id" value={initialInvoiceId} />
      <input type="hidden" name="allocations" value={JSON.stringify(allocationRows)} />

      <Card>
        <CardHeader><h2 className="font-semibold">Informations paiement</h2></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Client *</span>
            <CustomerCombobox customers={customers} value={customerId} onChange={handleCustomerChange} placeholder="Rechercher un client..." />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Type</span>
            <Select name="payment_type" defaultValue={initialValues?.payment_type ?? "customer_payment"}>
              {paymentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Modalite *</span>
            <Select name="payment_method" defaultValue={initialValues?.payment_method ?? "bank_transfer"}>
              {PAYMENT_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Compte d&apos;encaissement *</span>
            <Select name="treasury_account_id" defaultValue={treasuryAccounts[0]?.id ?? ""} required>
              <option value="">Selectionner...</option>
              {treasuryAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Date paiement</span>
            <DateField name="payment_date" defaultValue={initialValues?.payment_date ?? today()} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Date valeur</span>
            <DateField name="value_date" defaultValue={initialValues?.value_date ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Montant *</span>
            <MoneyInput name="amount" min={0.01} value={amount} onValueChange={(nextAmount) => setAmount(nextAmount ?? 0)} required />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Reference</span>
            <Input name="reference" defaultValue={initialValues?.reference ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Banque</span>
            <Input name="bank_name" defaultValue={initialValues?.bank_name ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Numero cheque</span>
            <Input name="check_number" defaultValue={initialValues?.check_number ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Reference virement</span>
            <Input name="transfer_reference" defaultValue={initialValues?.transfer_reference ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Echeance cheque/effet</span>
            <DateField name="due_date" defaultValue={initialValues?.due_date ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Notes</span>
            <Textarea name="notes" defaultValue={initialValues?.notes ?? ""} />
          </label>
          <label className="space-y-1.5 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--muted)]">Notes internes</span>
            <Textarea name="internal_notes" defaultValue={initialValues?.internal_notes ?? ""} />
          </label>
        </CardContent>
      </Card>

      {!customerId ? (
        <Card>
          <CardContent className="p-4 text-sm text-[var(--muted)]">Selectionnez d&apos;abord un client pour voir ses echeances ouvertes.</CardContent>
        </Card>
      ) : (
        <CustomerOpenItems
          openItems={openItems}
          paymentAmount={amount}
          allocations={allocations}
          loading={isLoadingOpenItems}
          error={openItemsError}
          onAllocationsChange={setAllocations}
        />
      )}

      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href={cancelHref}>Annuler</Link></Button>
        <Button disabled={pending || allocatedTotal > amount}>{submitLabel}</Button>
      </div>
    </form>
  );
}
