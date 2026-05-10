export type ThirdPartyKind = "prospect" | "customer" | "supplier";
export type ThirdPartyStatus = "active" | "inactive" | "archived" | "blocked";

export type ThirdPartyRecord = {
  id: string;
  organization_id: string;
  code: string | null;
  primary_type: ThirdPartyKind | null;
  types: ThirdPartyKind[] | null;
  name: string;
  alternative_name: string | null;
  commercial_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  website: string | null;
  email: string | null;
  rc: string | null;
  patente: string | null;
  if_number: string | null;
  cnss: string | null;
  ice: string | null;
  vat_subject: boolean | null;
  vat_number: string | null;
  payment_terms_days: number | null;
  credit_limit: number | null;
  cumulative_revenue: number | null;
  current_outstanding: number | null;
  default_discount_rate: number | null;
  customer_category: string | null;
  risk_level: string | null;
  preferred_payment_method: string | null;
  prospect_source: string | null;
  prospect_status: string | null;
  potential_value: number | null;
  next_follow_up_date: string | null;
  interest_level: string | null;
  sales_owner: string | null;
  prospect_notes: string | null;
  supplier_product_categories: string | null;
  supplier_payment_terms: string | null;
  supplier_rating: number | null;
  supplier_delivery_delay_days: number | null;
  supplier_main_contact: string | null;
  supplier_payment_method: string | null;
  supplier_notes: string | null;
  payment_terms: string | null;
  payment_method: string | null;
  custom_payment_terms: string | null;
  custom_payment_method: string | null;
  status: ThirdPartyStatus | string;
  notes: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ThirdPartyContact = {
  id: string;
  organization_id: string;
  third_party_id: string;
  full_name: string;
  job_title: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ThirdPartyAddress = {
  id: string;
  organization_id: string;
  third_party_id: string;
  label: string;
  type: "billing" | "delivery" | "other";
  address: string;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ThirdPartyAttachment = {
  id: string;
  organization_id: string;
  third_party_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_by_name?: string | null;
  uploaded_by_email?: string | null;
  signed_url?: string | null;
  created_at: string;
  archived_at: string | null;
};

export type ThirdPartyActivityItem = {
  id: string;
  action: string;
  description?: string | null;
  created_at: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ThirdPartyFilters = {
  query?: string;
  type?: ThirdPartyKind | "all";
  city?: string;
  status?: string;
  vat?: "all" | "yes" | "no";
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

export const THIRD_PARTY_TYPE_LABELS: Record<ThirdPartyKind, string> = {
  prospect: "Prospect",
  customer: "Client",
  supplier: "Fournisseur",
};

export const PROSPECT_STATUSES = [
  "nouveau",
  "contacte",
  "qualifie",
  "proposition envoyee",
  "negociation",
  "gagne",
  "perdu",
];

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

export function normalizeTypes(types: string[] | null | undefined): ThirdPartyKind[] {
  const allowed: ThirdPartyKind[] = ["prospect", "customer", "supplier"];
  return allowed.filter((type) => types?.includes(type));
}

export function typeLabel(type: ThirdPartyKind) {
  return THIRD_PARTY_TYPE_LABELS[type];
}
