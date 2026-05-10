import { PAYMENT_TERMS_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";

export function getPaymentTermLabel(value: string | null | undefined): string {
  if (!value) return "";
  const option = PAYMENT_TERMS_OPTIONS.find((o) => o.value === value);
  return option?.label ?? value;
}

export function getPaymentMethodLabel(value: string | null | undefined): string {
  if (!value) return "";
  const option = PAYMENT_METHOD_OPTIONS.find((o) => o.value === value);
  return option?.label ?? value;
}

export function getPaymentTermsDays(value: string | null | undefined): number | null {
  if (!value) return null;
  const map: Record<string, number | null> = {
    immediate: 0,
    on_receipt: 0,
    end_of_month: null,
    days_7: 7,
    days_15: 15,
    days_30: 30,
    days_45: 45,
    days_60: 60,
    days_90: 90,
    days_120: 120,
    days_30_end_of_month: null,
    days_45_end_of_month: null,
    days_60_end_of_month: null,
    multiple_installments: null,
    custom: null,
  };
  return map[value] ?? null;
}

export function calculateDueDate(invoiceDate: string, paymentTerms: string | null | undefined): string | null {
  if (!paymentTerms || !invoiceDate) return null;
  const date = new Date(invoiceDate + "T12:00:00");
  if (Number.isNaN(date.getTime())) return null;

  const days = getPaymentTermsDays(paymentTerms);

  if (days !== null) {
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  switch (paymentTerms) {
    case "end_of_month": {
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return lastDay.toISOString().split("T")[0];
    }
    case "days_30_end_of_month": {
      date.setDate(date.getDate() + 30);
      const eom = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return eom.toISOString().split("T")[0];
    }
    case "days_45_end_of_month": {
      date.setDate(date.getDate() + 45);
      const eom45 = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return eom45.toISOString().split("T")[0];
    }
    case "days_60_end_of_month": {
      date.setDate(date.getDate() + 60);
      const eom60 = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return eom60.toISOString().split("T")[0];
    }
    default:
      return null;
  }
}
