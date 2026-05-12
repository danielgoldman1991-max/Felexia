export type PurchaseDocumentType = "supplier_order" | "supplier_receipt";

export type SupplierOrderStatus = "draft" | "sent" | "confirmed" | "partially_received" | "received" | "cancelled";
export type SupplierReceiptStatus = "draft" | "validated" | "cancelled";
export type PurchaseDocumentStatus = SupplierOrderStatus | SupplierReceiptStatus;

export type PurchaseDocumentRecord = {
  id: string;
  organization_id: string;
  document_type: PurchaseDocumentType;
  document_number: string;
  supplier_id: string;
  source_document_id: string | null;
  related_order_id: string | null;
  document_date: string;
  expected_receipt_date: string | null;
  receipt_date: string | null;
  status: PurchaseDocumentStatus;
  subtotal_ht: number;
  discount_total: number;
  tax_total: number;
  total_ttc: number;
  currency: string;
  notes: string | null;
  internal_notes: string | null;
  validated_at: string | null;
  stock_updated_at: string | null;
  warehouse_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  supplier_name?: string | null;
  supplier_ice?: string | null;
  supplier_phone?: string | null;
  supplier_email?: string | null;
  warehouse_name?: string | null;
  source_document_number?: string | null;
  related_order_number?: string | null;
};

export type PurchaseDocumentLineRecord = {
  id: string;
  organization_id: string;
  document_id: string;
  source_line_id: string | null;
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
  ordered_quantity: number | null;
  received_quantity: number;
  remaining_quantity: number | null;
  stock_move_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseLineFormValue = {
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
};

export type PurchaseFormValues = {
  supplier_id: string;
  document_date: string;
  expected_receipt_date?: string;
  notes?: string;
  internal_notes?: string;
  lines: PurchaseLineFormValue[];
};

export type SupplierInvoiceStatus = "draft" | "validated" | "partially_paid" | "paid" | "cancelled";
export type SupplierPaymentStatus = "unpaid" | "partial" | "paid";

export type SupplierInvoiceRecord = {
  id: string;
  organization_id: string;
  invoice_number: string;
  supplier_invoice_number: string | null;
  supplier_id: string;
  source_type: string | null;
  source_receipt_id: string | null;
  invoice_date: string;
  due_date: string | null;
  status: SupplierInvoiceStatus;
  payment_status: SupplierPaymentStatus;
  subtotal_ht: number;
  discount_total: number;
  tax_total: number;
  total_ttc: number;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  notes: string | null;
  internal_notes: string | null;
  validated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  supplier_name?: string | null;
  supplier_ice?: string | null;
  supplier_phone?: string | null;
  supplier_email?: string | null;
};

export type SupplierInvoiceLineRecord = {
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

export type SupplierInvoiceLineFormValue = {
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
};

export type SupplierInvoiceFormValues = {
  supplier_id: string;
  invoice_date: string;
  due_date?: string;
  supplier_invoice_number?: string;
  notes?: string;
  internal_notes?: string;
  lines: SupplierInvoiceLineFormValue[];
};

export type SupplierPaymentRecord = {
  id: string;
  organization_id: string;
  payment_number: string;
  supplier_id: string;
  treasury_account_id?: string | null;
  payment_date: string;
  value_date: string | null;
  amount: number;
  allocated_amount: number;
  available_amount: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  bank_name: string | null;
  check_number: string | null;
  transfer_reference: string | null;
  due_date: string | null;
  status: string;
  payment_type: string;
  notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  supplier_name?: string | null;
};

export type SupplierPaymentAllocationRecord = {
  id: string;
  organization_id: string;
  payment_id: string;
  invoice_id: string;
  supplier_id: string;
  allocation_date: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  cancelled_at: string | null;
  invoice_number?: string | null;
  invoice_total_ttc?: number | null;
};

export type PurchaseActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export type PurchaseCounters = {
  draftOrders: number;
  confirmedOrders: number;
  draftReceipts: number;
  unpaidInvoices: number;
  totalToPay: number;
  unallocatedPayments: number;
};

export type PurchaseProductOption = {
  id: string;
  type: string;
  name: string;
  sku: string | null;
  purchase_price_ht: number;
  unit_name: string | null;
  unit_symbol: string | null;
  tax_rate_value: number | null;
  tax_rate_id: string | null;
  unit_id: string | null;
  is_purchasable: boolean;
};

export type ReceivableSupplierOrderLine = PurchaseDocumentLineRecord & {
  already_received: number;
  remaining_to_receive: number;
  track_stock: boolean;
  product_type: string | null;
  is_stockable: boolean;
};

export type ReceivableSupplierOrder = PurchaseDocumentRecord & {
  lines: ReceivableSupplierOrderLine[];
};

export type BillableSupplierReceipt = PurchaseDocumentRecord & {
  lines: PurchaseDocumentLineRecord[];
  already_invoiced: boolean;
};

export const PURCHASE_DOCUMENT_LABELS: Record<PurchaseDocumentType, string> = {
  supplier_order: "Commande fournisseur",
  supplier_receipt: "Reception fournisseur",
};

export const SUPPLIER_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  confirmed: "Confirmee",
  partially_received: "Partiellement recue",
  received: "Recue",
  cancelled: "Annulee",
};

export const SUPPLIER_RECEIPT_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  validated: "Validee",
  cancelled: "Annulee",
};

export const SUPPLIER_INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  validated: "Validee",
  partially_paid: "Partiellement payee",
  paid: "Payee",
  cancelled: "Annulee",
};

export const SUPPLIER_PAYMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirme",
  partially_allocated: "Partiellement affecte",
  allocated: "Affecte",
  cancelled: "Annule",
};

export const SUPPLIER_PAYMENT_TYPE_LABELS: Record<string, string> = {
  supplier_payment: "Paiement fournisseur",
  advance_payment: "Avance",
  deposit: "Acompte",
  other: "Autre",
};
