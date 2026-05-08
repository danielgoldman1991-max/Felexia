import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type {
  PaginatedResult,
  ProductCategory,
  ProductFilters,
  ProductRecord,
  TaxRate,
  Unit,
} from "@/lib/product-types";

const PRODUCT_SELECT = `
  id, organization_id, type, sku, barcode, name, description,
  category_id, unit_id, tax_rate_id,
  purchase_price_ht, sale_price_ht, sale_price_ttc,
  margin_amount, margin_rate,
  track_stock, min_stock, current_stock, stock_alert_enabled,
  default_discount_rate, is_sellable, is_purchasable,
  status, notes, created_by, created_at, updated_at, archived_at,
  category:category_id (name),
  unit:unit_id (name, symbol),
  tax_rate:tax_rate_id (name, rate)
`;

export async function listProducts(
  filters: ProductFilters = {},
): Promise<PaginatedResult<ProductRecord>> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  if (filters.category_id) {
    query = query.eq("category_id", filters.category_id);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.stockable === "yes") {
    query = query.eq("track_stock", true);
  } else if (filters.stockable === "no") {
    query = query.eq("track_stock", false);
  }

  if (filters.low_stock === "yes") {
    query = query.eq("stock_alert_enabled", true).gt("min_stock", 0);
  }

  if (filters.query) {
    const value = filters.query.trim();
    if (value) {
      query = query.or(
        `name.ilike.%${value}%,sku.ilike.%${value}%,barcode.ilike.%${value}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as unknown[]).map(mapProductRow);

  return {
    rows,
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  };
}

function mapProductRow(raw: unknown): ProductRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    type: row.type as ProductRecord["type"],
    sku: (row.sku as string) ?? null,
    barcode: (row.barcode as string) ?? null,
    name: row.name as string,
    description: (row.description as string) ?? null,
    category_id: (row.category_id as string) ?? null,
    unit_id: (row.unit_id as string) ?? null,
    tax_rate_id: (row.tax_rate_id as string) ?? null,
    purchase_price_ht: Number(row.purchase_price_ht ?? 0),
    sale_price_ht: Number(row.sale_price_ht ?? 0),
    sale_price_ttc: Number(row.sale_price_ttc ?? 0),
    margin_amount: Number(row.margin_amount ?? 0),
    margin_rate: Number(row.margin_rate ?? 0),
    track_stock: Boolean(row.track_stock),
    min_stock: Number(row.min_stock ?? 0),
    current_stock: Number(row.current_stock ?? 0),
    stock_alert_enabled: Boolean(row.stock_alert_enabled),
    default_discount_rate: Number(row.default_discount_rate ?? 0),
    is_sellable: Boolean(row.is_sellable),
    is_purchasable: Boolean(row.is_purchasable),
    status: (row.status as string) ?? "active",
    notes: (row.notes as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string) ?? null,
    category_name: extractJoinedName(row.category),
    unit_name: extractJoinedName(row.unit),
    unit_symbol: extractJoinedSymbol(row.unit),
    tax_rate_name: extractJoinedName(row.tax_rate),
    tax_rate_value: extractJoinedRate(row.tax_rate),
  };
}

function extractJoinedName(val: unknown): string | null {
  if (!val || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;
  return (obj.name as string) ?? null;
}

function extractJoinedSymbol(val: unknown): string | null {
  if (!val || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;
  return (obj.symbol as string) ?? null;
}

function extractJoinedRate(val: unknown): number | null {
  if (!val || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;
  return (obj.rate as number) ?? null;
}

export async function getProduct(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    product: data ? mapProductRow(data) : null,
  };
}

export async function getProductDetail(id: string) {
  const { product } = await getProduct(id);
  return { product };
}

export async function getProductByIdOrSku(identifier: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = uuidRegex.test(identifier);

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("organization_id", workspace.organization.id)
    .eq(isUuid ? "id" : "sku", identifier)
    .is("archived_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    product: data ? mapProductRow(data) : null,
  };
}

export async function getProductCounters() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  function base() {
    return supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null);
  }

  const [
    { count: total },
    { count: products },
    { count: services },
    { count: stockable },
    { count: lowStock },
  ] = await Promise.all([
    base(),
    base().eq("type", "product"),
    base().eq("type", "service"),
    base().eq("track_stock", true),
    base().eq("stock_alert_enabled", true).gt("min_stock", 0),
  ]);

  // Average sale price and margin (need data for these)
  const { data: priceData } = await supabase
    .from("products")
    .select("sale_price_ht, margin_rate")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null);

  const count = priceData?.length ?? 0;
  const avgPrice = count > 0
    ? (priceData!.reduce((sum, r) => sum + Number(r.sale_price_ht ?? 0), 0) / count)
    : 0;
  const avgMargin = count > 0
    ? (priceData!.reduce((sum, r) => sum + Number(r.margin_rate ?? 0), 0) / count)
    : 0;

  return {
    total: total ?? 0,
    products: products ?? 0,
    services: services ?? 0,
    stockable: stockable ?? 0,
    lowStock: lowStock ?? 0,
    avgPrice,
    avgMargin,
  };
}

export async function listProductCategories() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProductCategory[];
}

export async function listUnits() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Unit[];
}

export async function listTaxRates() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("rate", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TaxRate[];
}

export function filtersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  forcedType?: ProductRecord["type"],
): ProductFilters {
  const pick = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rawPage = pick("page");
  const page = rawPage ? Number(rawPage) : undefined;

  return {
    query: pick("q") ?? "",
    type: forcedType ?? ((pick("type") as ProductFilters["type"]) || "all"),
    category_id: pick("category_id") ?? undefined,
    status: pick("status") ?? "active",
    stockable: (pick("stockable") as ProductFilters["stockable"]) || "all",
    low_stock: (pick("low_stock") as ProductFilters["low_stock"]) || "all",
    page: page && Number.isFinite(page) && page >= 1 ? page : undefined,
    limit: 25,
  };
}
