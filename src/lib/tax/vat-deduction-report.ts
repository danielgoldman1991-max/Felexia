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
