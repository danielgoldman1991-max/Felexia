export type SalesDocumentType = "quote" | "order" | "delivery_note" | "return_note";

export type SalesQuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "converted" | "cancelled";
export type SalesOrderStatus = "draft" | "confirmed" | "partially_delivered" | "delivered" | "cancelled";
export type SalesDeliveryStatus = "draft" | "validated" | "delivered" | "cancelled";
export type SalesReturnStatus = "draft" | "validated" | "cancelled";
export type SalesDocumentStatus = SalesQuoteStatus | SalesOrderStatus | SalesDeliveryStatus | SalesReturnStatus;

export type SalesDocumentRecord = {
  id: string;
  organization_id: string;
  document_type: SalesDocumentType;
  document_number: string;
  customer_id: string;
  source_document_id: string | null;
  related_order_id: string | null;
  related_delivery_id: string | null;
  document_date: string;
  valid_until: string | null;
  expected_delivery_date: string | null;
  status: SalesDocumentStatus;
  subtotal_ht: number;
  tax_total: number;
  total_ttc: number;
  notes: string | null;
  internal_notes: string | null;
  return_reason: string | null;
  return_status: string | null;
  stock_updated_at: string | null;
  validated_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
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
  source_document_type?: SalesDocumentType | null;
  related_order_number?: string | null;
  related_delivery_number?: string | null;
};

export type SalesDocumentLineRecord = {
  id: string;
  organization_id: string;
  document_id: string;
  line_order: number;
  source_line_id: string | null;
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
  tax_amount: number;
  total_ttc: number;
  ordered_quantity: number | null;
  delivered_quantity: number;
  returned_quantity: number;
  remaining_quantity: number | null;
  stock_move_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryPreparationLine = SalesDocumentLineRecord & {
  already_delivered: number;
  remaining_to_deliver: number;
  current_stock: number | null;
  track_stock: boolean;
  product_type: string | null;
  is_stockable: boolean;
};

export type ReturnPreparationLine = SalesDocumentLineRecord & {
  already_returned: number;
  returnable_quantity: number;
};

export type SalesLineFormValue = {
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
  tax_amount: number;
  total_ttc: number;
};

export type SalesDocumentFormValues = {
  customer_id: string;
  document_date: string;
  valid_until?: string;
  expected_delivery_date?: string;
  notes?: string;
  internal_notes?: string;
  lines: SalesLineFormValue[];
};

export type SalesCounters = {
  draftQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  confirmedOrders: number;
  draftDeliveries: number;
  quoteAmount: number;
  orderAmount: number;
};

export type ProductForSalesSelect = {
  id: string;
  type: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  unit_id: string | null;
  unit_name: string | null;
  unit_symbol: string | null;
  sale_price_ht: number;
  tax_rate_id: string | null;
  tax_rate_value: number | null;
  status: string | null;
};

export type CustomerForSalesSelect = {
  id: string;
  name: string;
  commercial_name: string | null;
  ice: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

export type UnitForSalesSelect = {
  id: string;
  name: string;
  symbol: string;
  status: string | null;
};

export type TaxRateForSalesSelect = {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
  status: string | null;
};

export type SalesActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export type ManualDeliveryOrderOption = {
  id: string;
  document_number: string;
  customer_name: string | null;
  document_date: string;
  status: SalesOrderStatus;
  total_ttc: number;
  ordered_total_quantity: number;
  delivered_total_quantity: number;
  remaining_total_quantity: number;
};

export type ManualDeliveryLine = DeliveryPreparationLine & {
  order_line_id: string;
  ordered_quantity: number;
  already_delivered_quantity: number;
  remaining_quantity_to_deliver: number;
};

export type ManualDeliveryPreparation = {
  order: SalesDocumentRecord | null;
  customer: Record<string, unknown> | null;
  lines: ManualDeliveryLine[];
};

export type ManualDeliveryFormLine = {
  source_line_id: string;
  quantity: number;
};

export type DeliveryDocumentDetail = {
  document: SalesDocumentRecord | null;
  customer: Record<string, unknown> | null;
  lines: SalesDocumentLineRecord[];
  sourceDocument: Record<string, unknown> | null;
};

export type SalesListFilters = {
  type?: SalesDocumentType;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedSalesResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const SALES_DOCUMENT_LABELS: Record<SalesDocumentType, string> = {
  quote: "Devis",
  order: "Commande client",
  delivery_note: "Bon de livraison",
  return_note: "Bon de retour",
};

export const SALES_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  rejected: "Rejete",
  converted: "Converti",
  confirmed: "Confirmee",
  partially_delivered: "Partiellement livree",
  validated: "Valide",
  delivered: "Livre",
  cancelled: "Annule",
};
