import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type {
  SalesQuoteRecord,
  SalesQuoteLineRecord,
  SalesOrderRecord,
  SalesOrderLineRecord,
  DeliveryNoteRecord,
  DeliveryNoteLineRecord,
  CommerceListFilters,
  PaginatedResult,
  CommerceCounters,
  SalesQuoteStatus,
  SalesOrderStatus,
  DeliveryNoteStatus,
} from "@/lib/commerce-types";

export {
  listUnits as listUnitsForSelect,
  listTaxRates as listTaxRatesForSelect,
} from "@/lib/products";

const QUOTE_SELECT = `
  id, organization_id, number, third_party_id, contact_id,
  document_date, valid_until, status, currency, payment_terms_days,
  subtotal, subtotal_ht, discount_total, tax_total, total, total_ttc,
  notes, internal_notes, converted_order_id, converted_at,
  created_by, created_at, updated_at, archived_at,
  customer:third_party_id (name, city)
`;

const ORDER_SELECT = `
  id, organization_id, number, quote_id, third_party_id, contact_id,
  document_date, due_date, expected_delivery_date, status, currency,
  payment_terms_days, subtotal, subtotal_ht, discount_total, tax_total,
  total, total_ttc, delivered_total, notes, internal_notes,
  created_by, created_at, updated_at, archived_at,
  customer:third_party_id (name, city),
  quote:quote_id (number)
`;

const DELIVERY_SELECT = `
  id, organization_id, number, order_id, third_party_id, contact_id,
  document_date, delivered_at, delivery_date, delivery_address, status,
  notes, internal_notes,
  created_by, created_at, updated_at, archived_at,
  customer:third_party_id (name),
  order:order_id (number)
`;

const QUOTE_LINE_SELECT = `
  id, organization_id, quote_id, product_id, line_order, description,
  quantity, unit_id, unit_price, unit_price_ht, discount_rate,
  tax_rate_id, tax_rate, tax_amount, subtotal_ht, line_total, total_ttc,
  created_at, updated_at,
  product:product_id (name),
  unit:unit_id (name, symbol)
`;

const ORDER_LINE_SELECT = `
  id, organization_id, order_id, quote_line_id, product_id, line_order,
  description, quantity, delivered_quantity, unit_id, unit_price,
  unit_price_ht, discount_rate, tax_rate_id, tax_rate, tax_amount,
  subtotal_ht, line_total, total_ttc,
  created_at, updated_at,
  product:product_id (name),
  unit:unit_id (name, symbol)
`;

const DELIVERY_LINE_SELECT = `
  id, organization_id, delivery_note_id, order_line_id, product_id,
  line_order, description, quantity, delivered_quantity, unit_id,
  created_at, updated_at,
  product:product_id (name),
  unit:unit_id (name, symbol)
`;

const PRODUCT_FOR_SELECT = `
  id, name, sale_price, sale_price_ht, unit_id, tax_rate_id,
  type, description, sku, status,
  unit:unit_id (name, symbol),
  tax_rate:tax_rate_id (name, rate)
`;

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

function mapQuoteRow(raw: unknown): SalesQuoteRecord {
  const row = raw as Record<string, unknown>;
  const customer = row.customer as Record<string, unknown> | null;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    number: (row.number as string) ?? null,
    third_party_id: row.third_party_id as string,
    contact_id: (row.contact_id as string) ?? null,
    document_date: row.document_date as string,
    valid_until: (row.valid_until as string) ?? null,
    status: row.status as SalesQuoteStatus,
    currency: row.currency as string,
    payment_terms_days: Number(row.payment_terms_days ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    discount_total: Number(row.discount_total ?? 0),
    tax_total: Number(row.tax_total ?? 0),
    total: Number(row.total ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    notes: (row.notes as string) ?? null,
    internal_notes: (row.internal_notes as string) ?? null,
    converted_order_id: (row.converted_order_id as string) ?? null,
    converted_at: (row.converted_at as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string) ?? null,
    customer_name: customer?.name as string | null ?? null,
    customer_city: customer?.city as string | null ?? null,
  };
}

function mapQuoteLineRow(raw: unknown): SalesQuoteLineRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    quote_id: row.quote_id as string,
    product_id: (row.product_id as string) ?? null,
    line_order: Number(row.line_order ?? 0),
    description: row.description as string,
    quantity: Number(row.quantity ?? 0),
    unit_id: (row.unit_id as string) ?? null,
    unit_price: Number(row.unit_price ?? 0),
    unit_price_ht: Number(row.unit_price_ht ?? 0),
    discount_rate: Number(row.discount_rate ?? 0),
    tax_rate_id: (row.tax_rate_id as string) ?? null,
    tax_rate: Number(row.tax_rate ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    line_total: Number(row.line_total ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    product_name: extractJoinedName(row.product),
    unit_symbol: extractJoinedSymbol(row.unit),
  };
}

function mapOrderRow(raw: unknown): SalesOrderRecord {
  const row = raw as Record<string, unknown>;
  const customer = row.customer as Record<string, unknown> | null;
  const quote = row.quote as Record<string, unknown> | null;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    number: (row.number as string) ?? null,
    quote_id: (row.quote_id as string) ?? null,
    third_party_id: row.third_party_id as string,
    contact_id: (row.contact_id as string) ?? null,
    document_date: row.document_date as string,
    due_date: (row.due_date as string) ?? null,
    expected_delivery_date: (row.expected_delivery_date as string) ?? null,
    status: row.status as SalesOrderStatus,
    currency: row.currency as string,
    payment_terms_days: Number(row.payment_terms_days ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    discount_total: Number(row.discount_total ?? 0),
    tax_total: Number(row.tax_total ?? 0),
    total: Number(row.total ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    delivered_total: Number(row.delivered_total ?? 0),
    notes: (row.notes as string) ?? null,
    internal_notes: (row.internal_notes as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string) ?? null,
    customer_name: customer?.name as string | null ?? null,
    customer_city: customer?.city as string | null ?? null,
    quote_number: quote?.number as string | null ?? null,
  };
}

function mapOrderLineRow(raw: unknown): SalesOrderLineRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    order_id: row.order_id as string,
    quote_line_id: (row.quote_line_id as string) ?? null,
    product_id: (row.product_id as string) ?? null,
    line_order: Number(row.line_order ?? 0),
    description: row.description as string,
    quantity: Number(row.quantity ?? 0),
    delivered_quantity: Number(row.delivered_quantity ?? 0),
    unit_id: (row.unit_id as string) ?? null,
    unit_price: Number(row.unit_price ?? 0),
    unit_price_ht: Number(row.unit_price_ht ?? 0),
    discount_rate: Number(row.discount_rate ?? 0),
    tax_rate_id: (row.tax_rate_id as string) ?? null,
    tax_rate: Number(row.tax_rate ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    line_total: Number(row.line_total ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    product_name: extractJoinedName(row.product),
    unit_symbol: extractJoinedSymbol(row.unit),
  };
}

function mapDeliveryRow(raw: unknown): DeliveryNoteRecord {
  const row = raw as Record<string, unknown>;
  const customer = row.customer as Record<string, unknown> | null;
  const order = row.order as Record<string, unknown> | null;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    number: (row.number as string) ?? null,
    order_id: (row.order_id as string) ?? null,
    third_party_id: row.third_party_id as string,
    contact_id: (row.contact_id as string) ?? null,
    document_date: row.document_date as string,
    delivered_at: (row.delivered_at as string) ?? null,
    delivery_date: (row.delivery_date as string) ?? null,
    delivery_address: (row.delivery_address as string) ?? null,
    status: row.status as DeliveryNoteStatus,
    notes: (row.notes as string) ?? null,
    internal_notes: (row.internal_notes as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string) ?? null,
    customer_name: customer?.name as string | null ?? null,
    order_number: order?.number as string | null ?? null,
  };
}

function mapDeliveryLineRow(raw: unknown): DeliveryNoteLineRecord {
  const row = raw as Record<string, unknown>;
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    delivery_note_id: row.delivery_note_id as string,
    order_line_id: (row.order_line_id as string) ?? null,
    product_id: (row.product_id as string) ?? null,
    line_order: Number(row.line_order ?? 0),
    description: row.description as string,
    quantity: Number(row.quantity ?? 0),
    delivered_quantity: Number(row.delivered_quantity ?? 0),
    unit_id: (row.unit_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    product_name: extractJoinedName(row.product),
    unit_symbol: extractJoinedSymbol(row.unit),
  };
}

export async function getCommerceCounters(): Promise<CommerceCounters> {
  try {
    const workspace = await requireActiveWorkspace();
    const supabase = await createClient();

    function base() {
      return supabase
        .from("sales_quotes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", workspace.organization.id)
        .is("archived_at", null);
    }

    const [
      { count: draftQuotes, error: eq1 },
      { count: sentQuotes, error: eq2 },
      { count: acceptedQuotes, error: eq3 },
      { count: confirmedOrders, error: eq4 },
      { count: pendingDeliveries, error: eq5 },
    ] = await Promise.all([
      base().eq("status", "draft"),
      base().eq("status", "sent"),
      base().eq("status", "accepted"),
      supabase
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", workspace.organization.id)
        .is("archived_at", null)
        .eq("status", "confirmed"),
      supabase
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", workspace.organization.id)
        .is("archived_at", null)
        .eq("status", "partially_delivered"),
    ]);

    if (eq1 || eq2 || eq3 || eq4 || eq5) {
      console.error("getCommerceCounters: count query error", { eq1, eq2, eq3, eq4, eq5 });
    }

    const [quoteSumResult, orderSumResult] = await Promise.all([
      supabase
        .from("sales_quotes")
        .select("total")
        .eq("organization_id", workspace.organization.id)
        .is("archived_at", null)
        .eq("status", "accepted"),
      supabase
        .from("sales_orders")
        .select("total")
        .eq("organization_id", workspace.organization.id)
        .is("archived_at", null)
        .eq("status", "confirmed"),
    ]);

    if (quoteSumResult.error) console.error("getCommerceCounters: quote sum error", quoteSumResult.error);
    if (orderSumResult.error) console.error("getCommerceCounters: order sum error", orderSumResult.error);

    const quoteAmount = (quoteSumResult.data ?? []).reduce(
      (sum, r) => sum + Number(r.total ?? 0),
      0,
    );
    const orderAmount = (orderSumResult.data ?? []).reduce(
      (sum, r) => sum + Number(r.total ?? 0),
      0,
    );

    return {
      draftQuotes: draftQuotes ?? 0,
      sentQuotes: sentQuotes ?? 0,
      acceptedQuotes: acceptedQuotes ?? 0,
      confirmedOrders: confirmedOrders ?? 0,
      pendingDeliveries: pendingDeliveries ?? 0,
      quoteAmount,
      orderAmount,
    };
  } catch (err) {
    console.error("getCommerceCounters failed:", err);
    return { draftQuotes: 0, sentQuotes: 0, acceptedQuotes: 0, confirmedOrders: 0, pendingDeliveries: 0, quoteAmount: 0, orderAmount: 0 };
  }
}

export async function listSalesQuotes(
  filters: CommerceListFilters = {},
): Promise<PaginatedResult<SalesQuoteRecord>> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("sales_quotes")
    .select(QUOTE_SELECT, { count: "exact" })
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.third_party_id) {
    query = query.eq("third_party_id", filters.third_party_id);
  }

  if (filters.date_from) {
    query = query.gte("document_date", filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte("document_date", filters.date_to);
  }

  if (filters.query) {
    const value = filters.query.trim();
    if (value) {
      query = query.or(
        `number.ilike.%${value}%,third_party_id.name.ilike.%${value}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  return {
    rows: ((data ?? []) as unknown[]).map(mapQuoteRow),
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  };
}

export async function getSalesQuoteDetail(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const [quoteResult, linesResult] = await Promise.all([
    supabase
      .from("sales_quotes")
      .select(QUOTE_SELECT)
      .eq("organization_id", workspace.organization.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_quote_lines")
      .select(QUOTE_LINE_SELECT)
      .eq("organization_id", workspace.organization.id)
      .eq("quote_id", id)
      .order("line_order", { ascending: true }),
  ]);

  if (quoteResult.error) throw new Error(quoteResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);

  return {
    quote: quoteResult.data ? mapQuoteRow(quoteResult.data) : null,
    lines: ((linesResult.data ?? []) as unknown[]).map(mapQuoteLineRow),
  };
}

export async function listSalesOrders(
  filters: CommerceListFilters = {},
): Promise<PaginatedResult<SalesOrderRecord>> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("sales_orders")
    .select(ORDER_SELECT, { count: "exact" })
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.third_party_id) {
    query = query.eq("third_party_id", filters.third_party_id);
  }

  if (filters.date_from) {
    query = query.gte("document_date", filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte("document_date", filters.date_to);
  }

  if (filters.query) {
    const value = filters.query.trim();
    if (value) {
      query = query.or(
        `number.ilike.%${value}%,third_party_id.name.ilike.%${value}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  return {
    rows: ((data ?? []) as unknown[]).map(mapOrderRow),
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  };
}

export async function getSalesOrderDetail(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const [orderResult, linesResult] = await Promise.all([
    supabase
      .from("sales_orders")
      .select(ORDER_SELECT)
      .eq("organization_id", workspace.organization.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_order_lines")
      .select(ORDER_LINE_SELECT)
      .eq("organization_id", workspace.organization.id)
      .eq("order_id", id)
      .order("line_order", { ascending: true }),
  ]);

  if (orderResult.error) throw new Error(orderResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);

  return {
    order: orderResult.data ? mapOrderRow(orderResult.data) : null,
    lines: ((linesResult.data ?? []) as unknown[]).map(mapOrderLineRow),
  };
}

export async function listDeliveryNotes(
  filters: CommerceListFilters = {},
): Promise<PaginatedResult<DeliveryNoteRecord>> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("delivery_notes")
    .select(DELIVERY_SELECT, { count: "exact" })
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.third_party_id) {
    query = query.eq("third_party_id", filters.third_party_id);
  }

  if (filters.date_from) {
    query = query.gte("document_date", filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte("document_date", filters.date_to);
  }

  if (filters.query) {
    const value = filters.query.trim();
    if (value) {
      query = query.or(
        `number.ilike.%${value}%,third_party_id.name.ilike.%${value}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  return {
    rows: ((data ?? []) as unknown[]).map(mapDeliveryRow),
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  };
}

export async function getDeliveryNoteDetail(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const [deliveryResult, linesResult] = await Promise.all([
    supabase
      .from("delivery_notes")
      .select(DELIVERY_SELECT)
      .eq("organization_id", workspace.organization.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("delivery_note_lines")
      .select(DELIVERY_LINE_SELECT)
      .eq("organization_id", workspace.organization.id)
      .eq("delivery_note_id", id)
      .order("line_order", { ascending: true }),
  ]);

  if (deliveryResult.error) throw new Error(deliveryResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);

  return {
    delivery: deliveryResult.data ? mapDeliveryRow(deliveryResult.data) : null,
    lines: ((linesResult.data ?? []) as unknown[]).map(mapDeliveryLineRow),
  };
}

export async function listCustomersForSelect() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_parties")
    .select("id, name, city")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .contains("types", ["customer"])
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listProductsForSelect() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FOR_SELECT)
    .eq("organization_id", workspace.organization.id)
    .eq("status", "active")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown[]).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: row.id as string,
      name: row.name as string,
      sale_price_ht: Number(row.sale_price_ht ?? row.sale_price ?? 0) || Number(row.sale_price ?? 0),
      unit_id: (row.unit_id as string) ?? null,
      unit_symbol: extractJoinedSymbol(row.unit),
      tax_rate_id: (row.tax_rate_id as string) ?? null,
      tax_rate_value: extractJoinedRate(row.tax_rate),
      type: (row.type as string) ?? null,
      description: (row.description as string) ?? null,
      sku: (row.sku as string) ?? null,
      status: (row.status as string) ?? null,
    };
  });
}
