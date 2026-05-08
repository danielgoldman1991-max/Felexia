export type SalesQuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted"
  | "cancelled";

export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "partially_delivered"
  | "delivered"
  | "cancelled";

export type DeliveryNoteStatus =
  | "draft"
  | "validated"
  | "delivered"
  | "cancelled";

export type SalesQuoteRecord = {
  id: string;
  organization_id: string;
  number: string | null;
  third_party_id: string;
  contact_id: string | null;
  document_date: string;
  valid_until: string | null;
  status: SalesQuoteStatus;
  currency: string;
  payment_terms_days: number;
  subtotal: number;
  subtotal_ht: number;
  discount_total: number;
  tax_total: number;
  total: number;
  total_ttc: number;
  notes: string | null;
  internal_notes: string | null;
  converted_order_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joined
  customer_name?: string | null;
  customer_city?: string | null;
};

export type SalesQuoteLineRecord = {
  id: string;
  organization_id: string;
  quote_id: string;
  product_id: string | null;
  line_order: number;
  description: string;
  quantity: number;
  unit_id: string | null;
  unit_price: number;
  unit_price_ht: number;
  discount_rate: number;
  tax_rate_id: string | null;
  tax_rate: number;
  tax_amount: number;
  subtotal_ht: number;
  line_total: number;
  total_ttc: number;
  created_at: string;
  updated_at: string;
  // Joined
  product_name?: string | null;
  unit_symbol?: string | null;
};

export type SalesOrderRecord = {
  id: string;
  organization_id: string;
  number: string | null;
  quote_id: string | null;
  third_party_id: string;
  contact_id: string | null;
  document_date: string;
  due_date: string | null;
  expected_delivery_date: string | null;
  status: SalesOrderStatus;
  currency: string;
  payment_terms_days: number;
  subtotal: number;
  subtotal_ht: number;
  discount_total: number;
  tax_total: number;
  total: number;
  total_ttc: number;
  delivered_total: number;
  notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joined
  customer_name?: string | null;
  customer_city?: string | null;
  quote_number?: string | null;
};

export type SalesOrderLineRecord = {
  id: string;
  organization_id: string;
  order_id: string;
  quote_line_id: string | null;
  product_id: string | null;
  line_order: number;
  description: string;
  quantity: number;
  delivered_quantity: number;
  unit_id: string | null;
  unit_price: number;
  unit_price_ht: number;
  discount_rate: number;
  tax_rate_id: string | null;
  tax_rate: number;
  tax_amount: number;
  subtotal_ht: number;
  line_total: number;
  total_ttc: number;
  created_at: string;
  updated_at: string;
  // Joined
  product_name?: string | null;
  unit_symbol?: string | null;
};

export type DeliveryNoteRecord = {
  id: string;
  organization_id: string;
  number: string | null;
  order_id: string | null;
  third_party_id: string;
  contact_id: string | null;
  document_date: string;
  delivered_at: string | null;
  delivery_date: string | null;
  delivery_address: string | null;
  status: DeliveryNoteStatus;
  notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joined
  customer_name?: string | null;
  order_number?: string | null;
};

export type DeliveryNoteLineRecord = {
  id: string;
  organization_id: string;
  delivery_note_id: string;
  order_line_id: string | null;
  product_id: string | null;
  line_order: number;
  description: string;
  quantity: number;
  delivered_quantity: number;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  product_name?: string | null;
  unit_symbol?: string | null;
};

export type CommerceLineFormValue = {
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

export type CommerceLineValue = CommerceLineFormValue;

export type CommerceListFilters = {
  query?: string;
  status?: string;
  third_party_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CommerceActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export type ProductForSelect = {
  id: string;
  name: string;
  sale_price_ht: number;
  unit_id: string | null;
  unit_symbol: string | null;
  tax_rate_id: string | null;
  tax_rate_value: number | null;
  type: string | null;
  description: string | null;
  sku: string | null;
  status: string | null;
};

export type CommerceCounters = {
  draftQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  confirmedOrders: number;
  pendingDeliveries: number;
  quoteAmount: number;
  orderAmount: number;
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  rejected: "Rejete",
  expired: "Expire",
  converted: "Converti",
  cancelled: "Annule",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirmee",
  partially_delivered: "Partiellement livree",
  delivered: "Livree",
  cancelled: "Annulee",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  validated: "Valide",
  delivered: "Livree",
  cancelled: "Annule",
};
