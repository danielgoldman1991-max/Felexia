export type ProductType = "product" | "service";
export type ProductStatus = "active" | "inactive" | "archived";
export type CategoryType = "product" | "service" | "mixed";

export type ProductRecord = {
  id: string;
  organization_id: string;
  type: ProductType;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  tax_rate_id: string | null;
  purchase_price_ht: number;
  sale_price_ht: number;
  sale_price_ttc: number;
  margin_amount: number;
  margin_rate: number;
  track_stock: boolean;
  min_stock: number;
  current_stock: number;
  stock_alert_enabled: boolean;
  default_discount_rate: number;
  is_sellable: boolean;
  is_purchasable: boolean;
  status: ProductStatus | string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joined fields
  category_name?: string | null;
  unit_name?: string | null;
  unit_symbol?: string | null;
  tax_rate_name?: string | null;
  tax_rate_value?: number | null;
};

export type ProductCategory = {
  id: string;
  organization_id: string;
  code: string | null;
  name: string;
  description: string | null;
  parent_id: string | null;
  type: CategoryType;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  created_by: string | null;
};

export type Unit = {
  id: string;
  organization_id: string;
  name: string;
  symbol: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  created_by: string | null;
};

export type TaxRate = {
  id: string;
  organization_id: string;
  name: string;
  rate: number;
  code: string | null;
  description: string | null;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  created_by: string | null;
};

export type ProductFormValues = {
  type: ProductType;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  category_id?: string;
  unit_id?: string;
  tax_rate_id?: string;
  purchase_price_ht: number;
  sale_price_ht: number;
  track_stock: boolean;
  min_stock: number;
  current_stock: number;
  stock_alert_enabled: boolean;
  default_discount_rate: number;
  is_sellable: boolean;
  is_purchasable: boolean;
  status: ProductStatus | string;
  notes?: string;
};

export type ProductFilters = {
  query?: string;
  type?: ProductType | "all";
  category_id?: string;
  status?: string;
  stockable?: "all" | "yes" | "no";
  low_stock?: "all" | "yes" | "no";
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

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  product: "Produit",
  service: "Service",
};

export const PROSPECT_SOURCES = [
  "Facebook",
  "Instagram",
  "Google Ads",
  "Google Business Profile",
  "Site web",
  "SEO / Referencement naturel",
  "WhatsApp",
  "Appel entrant",
  "Terrain",
  "Recommandation",
  "Bouche-a-oreille",
  "Partenaire",
  "Salon / Evenement",
  "Emailing",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Autre",
];
