export type CustomerPaymentStatus = "draft" | "confirmed" | "partially_allocated" | "allocated" | "cancelled";
export type CustomerPaymentType = "customer_payment" | "advance_payment" | "deposit" | "overpayment" | "refund_received" | "other";

export type CustomerPaymentRecord = {
  id: string;
  organization_id: string;
  payment_number: string;
  third_party_id: string;
  customer_name?: string | null;
  payment_date: string;
  value_date: string | null;
  amount: number;
  allocated_amount: number;
  available_amount: number;
  currency: string;
  payment_method: string;
  reference: string | null;
  bank_name: string | null;
  check_number: string | null;
  transfer_reference: string | null;
  due_date: string | null;
  status: CustomerPaymentStatus;
  payment_type: CustomerPaymentType;
  source_type: string | null;
  source_invoice_id: string | null;
  source_invoice_number?: string | null;
  treasury_account_id?: string | null;
  notes: string | null;
  internal_notes: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CustomerPaymentAllocationRecord = {
  id: string;
  organization_id: string;
  payment_id: string;
  invoice_id: string;
  third_party_id: string;
  allocation_date: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  cancelled_at: string | null;
  invoice_number?: string | null;
  invoice_total_ttc?: number | null;
};

export type CustomerPaymentDetail = {
  payment: CustomerPaymentRecord | null;
  allocations: CustomerPaymentAllocationRecord[];
};

export type CustomerPaymentFormValues = {
  customer_id: string;
  payment_type: CustomerPaymentType;
  payment_date: string;
  value_date?: string | null;
  amount: number;
  payment_method: string;
  reference?: string | null;
  bank_name?: string | null;
  check_number?: string | null;
  transfer_reference?: string | null;
  due_date?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  treasury_account_id?: string | null;
};

export type PaymentAllocationFormValues = {
  payment_id: string;
  invoice_id: string;
  amount: number;
  allocation_date?: string;
  notes?: string | null;
};

export type PaymentListFilters = {
  query?: string;
  customerId?: string;
  status?: string;
  paymentMethod?: string;
  availableOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type PaymentCounters = {
  receivedTotal: number;
  unallocatedCount: number;
  availableTotal: number;
  unpaidInvoices: number;
  partiallyPaidInvoices: number;
  remainingToCollect: number;
};

export type OpenInvoiceForAllocation = {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string | null;
  invoice_date: string;
  due_date: string | null;
  total_ttc: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  status: string;
};

export type OpenInvoiceForPayment = OpenInvoiceForAllocation & {
  is_overdue: boolean;
};

export type CustomerOpenItems = {
  customer: {
    id: string;
    name: string;
    commercial_name?: string | null;
  } | null;
  invoices: OpenInvoiceForPayment[];
  credits: [];
  summary: {
    total_open_invoices: number;
    overdue_amount: number;
    total_remaining_amount: number;
    invoices_count: number;
  };
};

export type CustomerOutstandingBalance = {
  customer_id: string;
  invoices_count: number;
  total_due: number;
  available_payments: number;
};

export type PaymentActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export const CUSTOMER_PAYMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirme",
  partially_allocated: "Partiellement affecte",
  allocated: "Affecte",
  cancelled: "Annule",
};

export const CUSTOMER_PAYMENT_TYPE_LABELS: Record<string, string> = {
  customer_payment: "Reglement client",
  advance_payment: "Avance client",
  deposit: "Acompte",
  overpayment: "Trop-percu",
  refund_received: "Remboursement recu",
  other: "Autre",
};
