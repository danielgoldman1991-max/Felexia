export type DeductionPayment = { date: string | null; mode: string | null };

export type DeductionInvoice = {
  supplier: string;
  ifNumber: string | null;
  ice: string | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  amountHt: number;
  vatAmount: number;
  payments: DeductionPayment[];
};

const PAYMENT_MODES: Record<string, string> = {
  bank_transfer: "Virement",
  transfer: "Virement",
  virement: "Virement",
  cash: "Espèces",
  especes: "Espèces",
  cheque: "Chèque",
  check: "Chèque",
  card: "Carte",
  carte: "Carte",
  other: "Autre",
};

export const DEDUCTION_HEADERS = [
  "Fournisseur",
  "IF",
  "ICE",
  "N° facture",
  "Date facture",
  "HT",
  "TVA",
  "Date de paiement",
  "Mode de paiement",
] as const;

export function paymentModeLabel(mode: string | null | undefined) {
  const key = (mode ?? "").trim().toLowerCase();
  if (!key) return "";
  return PAYMENT_MODES[key] ?? mode ?? "";
}

function money(value: number) {
  return value.toFixed(2).replace(".", ",");
}

export function deductionTable(invoices: DeductionInvoice[]): string[][] {
  return [
    [...DEDUCTION_HEADERS],
    ...invoices.map((invoice) => {
      const dates = [...new Set(invoice.payments.map((payment) => payment.date).filter((date): date is string => Boolean(date)))];
      const modes = [...new Set(invoice.payments.map((payment) => paymentModeLabel(payment.mode)).filter(Boolean))];
      return [
        invoice.supplier,
        invoice.ifNumber ?? "",
        invoice.ice ?? "",
        invoice.invoiceNumber,
        invoice.invoiceDate ?? "",
        money(invoice.amountHt),
        money(invoice.vatAmount),
        dates.join(" ; "),
        modes.join(" ; "),
      ];
    }),
  ];
}

export function deductionPeriod(from: string | null, to: string | null) {
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return { ok: false as const, error: "Indiquez une période valide, du jour le plus ancien au plus récent." };
  }
  return { ok: true as const, from, to };
}

const COUNTED_PAYMENT = new Set(["confirmed", "partially_allocated", "allocated", "validated", "paid", "completed", "posted", "reconciled"]);

export function countedPayment(status: string | null | undefined) {
  return COUNTED_PAYMENT.has(String(status ?? "").toLowerCase());
}

export type AllocationPaymentLink = {
  invoiceId: string;
  paymentId: string;
  amount: number | null;
  allocationDate: string | null;
  payment: { date: string | null; mode: string | null; status: string | null; reference: string | null } | null;
};

/** Join allocations to payments by id. Production has no FK, so PostgREST cannot embed payment_id. */
export function linkAllocationPayments(
  allocations: Array<{ invoice_id?: string | null; payment_id?: string | null; amount?: number | null; allocation_date?: string | null }>,
  payments: Array<{ id?: string | null; payment_date?: string | null; payment_method?: string | null; status?: string | null; reference?: string | null }>,
): AllocationPaymentLink[] {
  const byId = new Map(payments.filter((payment) => payment.id).map((payment) => [String(payment.id), payment]));
  return allocations.flatMap((allocation) => {
    if (!allocation.invoice_id || !allocation.payment_id) return [];
    const payment = byId.get(String(allocation.payment_id));
    return [{
      invoiceId: String(allocation.invoice_id),
      paymentId: String(allocation.payment_id),
      amount: allocation.amount == null ? null : Number(allocation.amount),
      allocationDate: allocation.allocation_date ?? null,
      payment: payment
        ? {
          date: payment.payment_date ?? null,
          mode: payment.payment_method ?? null,
          status: payment.status ?? null,
          reference: payment.reference ?? null,
        }
        : null,
    }];
  });
}
