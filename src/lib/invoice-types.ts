export type CustomerInvoiceStatus = "draft" | "validated" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type CustomerInvoicePaymentStatus = "unpaid" | "partial" | "paid";
export type CustomerInvoiceSourceType = "manual" | "order" | "delivery_note" | "grouped_delivery_notes";
export type CustomerInvoiceAccountingStatus = "posted" | "not_posted" | "pending_validation" | "not_applicable";

export type CustomerInvoiceRecord = {
  id: string;
  organization_id: string;
  invoice_number: string;
  customer_id: string;
  source_type: CustomerInvoiceSourceType | null;
  source_document_id: string | null;
  source_order_id: string | null;
  source_delivery_id: string | null;
  invoice_date: string;
  due_date: string | null;
  status: CustomerInvoiceStatus;
  payment_status: CustomerInvoicePaymentStatus;
  payment_terms_days: number;
  paid_amount: number;
  credit_amount: number;
  remaining_amount: number;
  subtotal_ht: number;
  discount_total: number;
  tax_total: number;
  total_ttc: number;
  currency: string;
  payment_terms: string | null;
  payment_method: string | null;
  custom_payment_terms: string | null;
  custom_payment_method: string | null;
  notes: string | null;
  internal_notes: string | null;
  validated_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_ice?: string | null;
  source_document_number?: string | null;
  source_order_number?: string | null;
  source_delivery_number?: string | null;
  accounting_entry_id?: string | null;
  accounting_entry_number?: string | null;
  accounting_status?: CustomerInvoiceAccountingStatus;
};

export type CustomerInvoiceLineRecord = {
  id: string;
  organization_id: string;
  invoice_id: string;
  source_line_id: string | null;
  source_document_id: string | null;
  line_order: number;
  product_id: string | null;
  product_name: string | null;
  description: string;
  quantity: number;
  unit_id: string | null;
  unit_name: string | null;
  unit_price_ht: number;
  discount_rate: number;
  tax_rate_id: string | null;
  tax_rate: number;
  subtotal_ht: number;
  discount_amount: number;
  tax_amount: number;
  total_ttc: number;
  created_at: string;
  updated_at: string;
};

export type CustomerInvoiceDetail = {
  invoice: CustomerInvoiceRecord | null;
  lines: CustomerInvoiceLineRecord[];
};

export type InvoiceLineFormValue = {
  id: string;
  mode: "free" | "product";
  product_id: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_id: string;
  unit_name: string;
  unit_price_ht: number;
  discount_rate: number;
  tax_rate_id: string;
  tax_rate: number;
  subtotal_ht: number;
  discount_amount: number;
  tax_amount: number;
  total_ttc: number;
  source_line_id?: string | null;
  source_document_id?: string | null;
  source_label?: string | null;
};

export type InvoiceFormValues = {
  customer_id: string;
  invoice_date: string;
  due_date?: string;
  payment_terms_days?: number;
  payment_terms?: string | null;
  payment_method?: string | null;
  custom_payment_terms?: string | null;
  custom_payment_method?: string | null;
  notes?: string;
  internal_notes?: string;
  source_type?: CustomerInvoiceSourceType;
  source_document_id?: string;
  lines: InvoiceLineFormValue[];
};

export type InvoiceListFilters = {
  query?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  pageSize?: number;
};

export type InvoiceCounters = {
  draft: number;
  validated: number;
  sent: number;
  overdue: number;
  invoicedTotal: number;
  paidTotal: number;
  remainingTotal: number;
};

export type InvoiceCustomerOption = {
  id: string;
  name: string;
  commercial_name?: string | null;
  ice?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  types?: string[] | null;
  primary_type?: string | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  payment_terms_days?: number | null;
  custom_payment_terms?: string | null;
  custom_payment_method?: string | null;
};

export type InvoiceProductOption = {
  id: string;
  type: "product" | "service";
  sku?: string | null;
  name: string;
  description?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  unit_symbol?: string | null;
  sale_price_ht?: number | null;
  tax_rate_id?: string | null;
  tax_rate_value?: number | null;
};

export type BillableOrderOption = {
  id: string;
  document_number: string;
  customer_name: string | null;
  document_date: string;
  status: string;
  total_ttc: number;
};

export type BillableDeliveryOption = {
  id: string;
  document_number: string;
  customer_id?: string;
  customer_name: string | null;
  document_date: string;
  status: string;
  related_order_number: string | null;
  lines_count?: number;
  total_quantity?: number;
  already_invoiced?: boolean;
};

export type InvoiceActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export type OrderBillingGuardInvoice = {
  id: string;
  invoice_number: string;
  status: string;
  total_ttc: number;
};

export type OrderBillingGuardDeliveryInvoice = OrderBillingGuardInvoice & {
  delivery_id: string | null;
  delivery_number: string | null;
};

export type OrderBillingGuard = {
  orderId: string;
  isBlocked: boolean;
  reason: string | null;
  directInvoice: OrderBillingGuardInvoice | null;
  deliveryInvoices: OrderBillingGuardDeliveryInvoice[];
  billableMode: "direct" | "delivery" | "none";
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  validated: "Validee",
  sent: "Envoyee",
  partially_paid: "Partiellement payee",
  paid: "Payee",
  overdue: "En retard",
  cancelled: "Annulee",
};

export const INVOICE_PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Non payee",
  partial: "Partielle",
  paid: "Payee",
};
