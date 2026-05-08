export type SalesDocumentType = "quote" | "order" | "delivery_note";

export type SalesQuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "converted" | "cancelled";
export type SalesOrderStatus = "draft" | "confirmed" | "delivered" | "cancelled";
export type SalesDeliveryStatus = "draft" | "validated" | "delivered" | "cancelled";
export type SalesDocumentStatus = SalesQuoteStatus | SalesOrderStatus | SalesDeliveryStatus;

export type SalesDocumentRecord = {
  id: string;
  organization_id: string;
  document_type: SalesDocumentType;
  document_number: string;
  customer_id: string;
  source_document_id: string | null;
  document_date: string;
  valid_until: string | null;
  expected_delivery_date: string | null;
  status: SalesDocumentStatus;
  subtotal_ht: number;
  tax_total: number;
  total_ttc: number;
  notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  customer_name?: string | null;
  customer_city?: string | null;
  source_document_number?: string | null;
  source_document_type?: SalesDocumentType | null;
};

export type SalesDocumentLineRecord = {
  id: string;
  organization_id: string;
  document_id: string;
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
  tax_amount: number;
  total_ttc: number;
  created_at: string;
  updated_at: string;
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
};

export const SALES_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  rejected: "Rejete",
  converted: "Converti",
  confirmed: "Confirmee",
  validated: "Valide",
  delivered: "Livre",
  cancelled: "Annule",
};
