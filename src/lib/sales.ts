import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type {
  CustomerForSalesSelect,
  DeliveryPreparationLine,
  ManualDeliveryOrderOption,
  ManualDeliveryPreparation,
  PaginatedSalesResult,
  ProductForSalesSelect,
  ReturnPreparationLine,
  SalesCounters,
  SalesDocumentLineRecord,
  SalesDocumentRecord,
  SalesDocumentType,
  SalesListFilters,
  TaxRateForSalesSelect,
  UnitForSalesSelect,
} from "@/lib/sales-types";

const SALES_DOCUMENT_SELECT = `
  id, organization_id, document_type, document_number, customer_id,
  source_document_id, related_order_id, related_delivery_id,
  document_date, valid_until, expected_delivery_date,
  status, subtotal_ht, tax_total, total_ttc, notes, internal_notes,
  return_reason, return_status, stock_updated_at, validated_at, delivered_at, returned_at,
  created_by, created_at, updated_at, archived_at,
  customer:customer_id (name, address, city, phone, email, ice),
  source_document:source_document_id (document_number, document_type)
`;

const SALES_LINE_SELECT = `
  id, organization_id, document_id, line_order, source_line_id, product_id, product_name,
  description, quantity, unit_id, unit_name, unit_price_ht, discount_rate,
  tax_rate_id, tax_rate, subtotal_ht, tax_amount, total_ttc,
  ordered_quantity, delivered_quantity, returned_quantity, remaining_quantity, stock_move_id,
  created_at, updated_at
`;

const SALES_PRODUCT_SELECT = `
  id, type, sku, name, description, unit_id, sale_price, sale_price_ht,
  tax_rate_id, status,
  unit:unit_id (name, symbol),
  tax_rate:tax_rate_id (name, rate)
`;

function extractObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return Array.isArray(value) ? (value[0] as Record<string, unknown> | undefined) ?? null : value as Record<string, unknown>;
}

function extractName(value: unknown): string | null {
  return (extractObject(value)?.name as string | undefined) ?? null;
}

function extractSymbol(value: unknown): string | null {
  return (extractObject(value)?.symbol as string | undefined) ?? null;
}

function extractRate(value: unknown): number | null {
  const rate = extractObject(value)?.rate;
  return rate === null || rate === undefined ? null : Number(rate);
}

function mapSalesDocument(raw: unknown): SalesDocumentRecord {
  const row = raw as Record<string, unknown>;
  const customer = extractObject(row.customer);
  const sourceDocument = extractObject(row.source_document);

  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    document_type: row.document_type as SalesDocumentType,
    document_number: row.document_number as string,
    customer_id: row.customer_id as string,
    source_document_id: (row.source_document_id as string) ?? null,
    related_order_id: (row.related_order_id as string) ?? null,
    related_delivery_id: (row.related_delivery_id as string) ?? null,
    document_date: row.document_date as string,
    valid_until: (row.valid_until as string) ?? null,
    expected_delivery_date: (row.expected_delivery_date as string) ?? null,
    status: row.status as SalesDocumentRecord["status"],
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    tax_total: Number(row.tax_total ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    notes: (row.notes as string) ?? null,
    internal_notes: (row.internal_notes as string) ?? null,
    return_reason: (row.return_reason as string) ?? null,
    return_status: (row.return_status as string) ?? null,
    stock_updated_at: (row.stock_updated_at as string) ?? null,
    validated_at: (row.validated_at as string) ?? null,
    delivered_at: (row.delivered_at as string) ?? null,
    returned_at: (row.returned_at as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string) ?? null,
    customer_name: (customer?.name as string | undefined) ?? null,
    customer_address: (customer?.address as string | undefined) ?? null,
    customer_city: (customer?.city as string | undefined) ?? null,
    customer_phone: (customer?.phone as string | undefined) ?? null,
    customer_email: (customer?.email as string | undefined) ?? null,
    customer_ice: (customer?.ice as string | undefined) ?? null,
    source_document_number: (sourceDocument?.document_number as string | undefined) ?? null,
    source_document_type: (sourceDocument?.document_type as SalesDocumentType | undefined) ?? null,
    related_order_number: null,
    related_delivery_number: null,
  };
}

async function enrichRelatedDocumentNumbers(
  organizationId: string,
  documents: SalesDocumentRecord[],
): Promise<SalesDocumentRecord[]> {
  const relatedIds = Array.from(
    new Set(
      documents
        .flatMap((document) => [document.related_order_id, document.related_delivery_id])
        .filter(Boolean),
    ),
  ) as string[];

  if (relatedIds.length === 0) return documents;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_documents")
    .select("id, document_number")
    .eq("organization_id", organizationId)
    .in("id", relatedIds);

  if (error) return documents;

  const numbersById = new Map((data ?? []).map((document) => [document.id, document.document_number]));

  return documents.map((document) => ({
    ...document,
    related_order_number: document.related_order_id ? numbersById.get(document.related_order_id) ?? null : null,
    related_delivery_number: document.related_delivery_id ? numbersById.get(document.related_delivery_id) ?? null : null,
  }));
}

function mapSalesLine(raw: unknown): SalesDocumentLineRecord {
  const row = raw as Record<string, unknown>;

  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    document_id: row.document_id as string,
    line_order: Number(row.line_order ?? 0),
    source_line_id: (row.source_line_id as string) ?? null,
    product_id: (row.product_id as string) ?? null,
    product_name: (row.product_name as string) ?? null,
    description: row.description as string,
    quantity: Number(row.quantity ?? 0),
    unit_id: (row.unit_id as string) ?? null,
    unit_name: (row.unit_name as string) ?? null,
    unit_price_ht: Number(row.unit_price_ht ?? 0),
    discount_rate: Number(row.discount_rate ?? 0),
    tax_rate_id: (row.tax_rate_id as string) ?? null,
    tax_rate: Number(row.tax_rate ?? 0),
    subtotal_ht: Number(row.subtotal_ht ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    total_ttc: Number(row.total_ttc ?? 0),
    ordered_quantity: row.ordered_quantity === null || row.ordered_quantity === undefined ? null : Number(row.ordered_quantity),
    delivered_quantity: Number(row.delivered_quantity ?? 0),
    returned_quantity: Number(row.returned_quantity ?? 0),
    remaining_quantity: row.remaining_quantity === null || row.remaining_quantity === undefined ? null : Number(row.remaining_quantity),
    stock_move_id: (row.stock_move_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function sumBySourceLine(rows: { source_line_id: string | null; quantity: number }[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    if (!row.source_line_id) return acc;
    acc[row.source_line_id] = (acc[row.source_line_id] ?? 0) + Number(row.quantity ?? 0);
    return acc;
  }, {});
}

type ProductStockInfo = {
  id: string;
  type: string | null;
  track_stock: boolean | null;
  current_stock: number | null;
};

async function getProductStockInfo(organizationId: string, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, ProductStockInfo>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, type, track_stock, current_stock")
    .eq("organization_id", organizationId)
    .in("id", productIds);

  if (error) throw new Error(error.message);

  return new Map(
    ((data ?? []) as ProductStockInfo[]).map((product) => [
      product.id,
      {
        ...product,
        current_stock: product.current_stock === null || product.current_stock === undefined
          ? null
          : Number(product.current_stock),
      },
    ]),
  );
}

export async function getActiveOrganizationId() {
  const workspace = await requireActiveWorkspace();
  return workspace.organization.id;
}

export async function listSalesCustomers(): Promise<CustomerForSalesSelect[]> {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_parties")
    .select("id, name, commercial_name, ice, city, email, phone")
    .eq("organization_id", organizationId)
    .contains("types", ["customer"])
    .eq("status", "active")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerForSalesSelect[];
}

export async function listSalesProducts(): Promise<ProductForSalesSelect[]> {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(SALES_PRODUCT_SELECT)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown[]).map((raw) => {
    const row = raw as Record<string, unknown>;
    const salePriceHt = Number(row.sale_price_ht ?? 0) || Number(row.sale_price ?? 0);
    return {
      id: row.id as string,
      type: (row.type as string) ?? null,
      sku: (row.sku as string) ?? null,
      name: row.name as string,
      description: (row.description as string) ?? null,
      unit_id: (row.unit_id as string) ?? null,
      unit_name: extractName(row.unit),
      unit_symbol: extractSymbol(row.unit),
      sale_price_ht: salePriceHt,
      tax_rate_id: (row.tax_rate_id as string) ?? null,
      tax_rate_value: extractRate(row.tax_rate),
      status: (row.status as string) ?? null,
    };
  });
}

export async function listSalesUnits(): Promise<UnitForSalesSelect[]> {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, name, symbol, status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as UnitForSalesSelect[];
}

export async function listSalesTaxRates(): Promise<TaxRateForSalesSelect[]> {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("id, name, rate, is_default, status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("rate", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    rate: Number(row.rate ?? 0),
    is_default: Boolean(row.is_default),
    status: row.status ?? null,
  }));
}

export async function getDefaultSalesTaxRate() {
  const taxRates = await listSalesTaxRates();
  return taxRates.find((taxRate) => taxRate.is_default) ?? taxRates[0] ?? null;
}

export async function listSalesDocuments(
  filters: SalesListFilters = {},
): Promise<PaginatedSalesResult<SalesDocumentRecord>> {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sales_documents")
    .select(SALES_DOCUMENT_SELECT, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.type) query = query.eq("document_type", filters.type);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.search?.trim()) {
    const value = filters.search.trim();
    query = query.or(`document_number.ilike.%${value}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = await enrichRelatedDocumentNumbers(
    organizationId,
    ((data ?? []) as unknown[]).map(mapSalesDocument),
  );

  return {
    rows,
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getSalesDocumentDetail(id: string) {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();

  const [documentResult, linesResult] = await Promise.all([
    supabase
      .from("sales_documents")
      .select(SALES_DOCUMENT_SELECT)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_document_lines")
      .select(SALES_LINE_SELECT)
      .eq("organization_id", organizationId)
      .eq("document_id", id)
      .order("line_order", { ascending: true }),
  ]);

  if (documentResult.error) throw new Error(documentResult.error.message);
  if (linesResult.error) throw new Error(linesResult.error.message);

  const documents = documentResult.data
    ? await enrichRelatedDocumentNumbers(organizationId, [mapSalesDocument(documentResult.data)])
    : [];

  return {
    document: documents[0] ?? null,
    customer: documentResult.data ? extractObject((documentResult.data as Record<string, unknown>).customer) : null,
    sourceDocument: documentResult.data ? extractObject((documentResult.data as Record<string, unknown>).source_document) : null,
    lines: ((linesResult.data ?? []) as unknown[]).map(mapSalesLine),
  };
}

export async function getOrderDeliveryPreparation(orderId: string) {
  const { document, lines } = await getSalesDocumentDetail(orderId);
  if (!document || document.document_type !== "order") {
    return { document: null, lines: [] as DeliveryPreparationLine[] };
  }

  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();
  const sourceLineIds = lines.map((line) => line.id);

  const { data: deliveryLines, error } = sourceLineIds.length > 0
    ? await supabase
        .from("sales_document_lines")
        .select("source_line_id, quantity, document:sales_documents!inner(document_type, status, organization_id)")
        .eq("organization_id", organizationId)
        .in("source_line_id", sourceLineIds)
        .eq("document.document_type", "delivery_note")
        .in("document.status", ["validated", "delivered"])
    : { data: [], error: null };

  if (error) throw new Error(error.message);
  const deliveredByLine = sumBySourceLine((deliveryLines ?? []) as { source_line_id: string | null; quantity: number }[]);
  const productIds = Array.from(new Set(lines.map((line) => line.product_id).filter(Boolean))) as string[];
  const stockByProductId = await getProductStockInfo(organizationId, productIds);

  return {
    document,
    lines: lines.map((line) => {
      const alreadyDelivered = deliveredByLine[line.id] ?? 0;
      const product = line.product_id ? stockByProductId.get(line.product_id) : null;
      const trackStock = Boolean(product?.track_stock);
      const productType = product?.type ?? null;
      return {
        ...line,
        already_delivered: alreadyDelivered,
        remaining_to_deliver: Math.max(Number(line.quantity) - alreadyDelivered, 0),
        current_stock: product?.current_stock ?? null,
        track_stock: trackStock,
        product_type: productType,
        is_stockable: trackStock && productType !== "service",
      };
    }),
  };
}

export async function getManualDeliveryPreparation(orderId: string): Promise<ManualDeliveryPreparation> {
  const { customer } = await getSalesDocumentDetail(orderId);
  const preparation = await getOrderDeliveryPreparation(orderId);

  return {
    order: preparation.document,
    customer,
    lines: preparation.lines.map((line) => ({
      ...line,
      order_line_id: line.id,
      ordered_quantity: Number(line.quantity ?? 0),
      already_delivered_quantity: line.already_delivered,
      remaining_quantity_to_deliver: line.remaining_to_deliver,
    })),
  };
}

export async function listDeliverableOrders(): Promise<ManualDeliveryOrderOption[]> {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();

  const { data: orders, error: orderError } = await supabase
    .from("sales_documents")
    .select(SALES_DOCUMENT_SELECT)
    .eq("organization_id", organizationId)
    .eq("document_type", "order")
    .in("status", ["confirmed", "partially_delivered"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (orderError) throw new Error(orderError.message);
  const documents = ((orders ?? []) as unknown[]).map(mapSalesDocument);
  if (documents.length === 0) return [];

  const orderIds = documents.map((order) => order.id);
  const { data: orderLines, error: lineError } = await supabase
    .from("sales_document_lines")
    .select("id, document_id, quantity")
    .eq("organization_id", organizationId)
    .in("document_id", orderIds);

  if (lineError) throw new Error(lineError.message);

  const lineRows = (orderLines ?? []) as { id: string; document_id: string; quantity: number }[];
  const sourceLineIds = lineRows.map((line) => line.id);

  const { data: deliveryLines, error: deliveryError } = sourceLineIds.length > 0
    ? await supabase
        .from("sales_document_lines")
        .select("source_line_id, quantity, document:sales_documents!inner(document_type, status, organization_id)")
        .eq("organization_id", organizationId)
        .in("source_line_id", sourceLineIds)
        .eq("document.document_type", "delivery_note")
        .in("document.status", ["validated", "delivered"])
    : { data: [], error: null };

  if (deliveryError) throw new Error(deliveryError.message);

  const deliveredByLine = sumBySourceLine((deliveryLines ?? []) as { source_line_id: string | null; quantity: number }[]);

  return documents
    .map((order) => {
      const lines = lineRows.filter((line) => line.document_id === order.id);
      const orderedTotal = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
      const deliveredTotal = lines.reduce(
        (sum, line) => sum + Math.min(Number(line.quantity ?? 0), deliveredByLine[line.id] ?? 0),
        0,
      );
      const remainingTotal = Math.max(orderedTotal - deliveredTotal, 0);

      return {
        id: order.id,
        document_number: order.document_number,
        customer_name: order.customer_name ?? null,
        document_date: order.document_date,
        status: order.status as ManualDeliveryOrderOption["status"],
        total_ttc: order.total_ttc,
        ordered_total_quantity: orderedTotal,
        delivered_total_quantity: deliveredTotal,
        remaining_total_quantity: remainingTotal,
      };
    })
    .filter((order) => order.remaining_total_quantity > 0);
}

export async function getReturnPreparation(deliveryId: string) {
  const { document, lines } = await getSalesDocumentDetail(deliveryId);
  if (!document || document.document_type !== "delivery_note") {
    return { document: null, lines: [] as ReturnPreparationLine[] };
  }

  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();
  const sourceLineIds = lines.map((line) => line.id);

  const { data: returnLines, error } = sourceLineIds.length > 0
    ? await supabase
        .from("sales_document_lines")
        .select("source_line_id, quantity, document:sales_documents!inner(document_type, status, organization_id)")
        .eq("organization_id", organizationId)
        .in("source_line_id", sourceLineIds)
        .eq("document.document_type", "return_note")
        .eq("document.status", "validated")
    : { data: [], error: null };

  if (error) throw new Error(error.message);
  const returnedByLine = sumBySourceLine((returnLines ?? []) as { source_line_id: string | null; quantity: number }[]);

  return {
    document,
    lines: lines.map((line) => {
      const alreadyReturned = returnedByLine[line.id] ?? 0;
      return {
        ...line,
        already_returned: alreadyReturned,
        returnable_quantity: Math.max(Number(line.quantity) - alreadyReturned, 0),
      };
    }),
  };
}

export async function getSalesCounters(): Promise<SalesCounters> {
  const organizationId = await getActiveOrganizationId();
  const supabase = await createClient();

  function countBase() {
    return supabase
      .from("sales_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null);
  }

  const [
    draftQuotes,
    sentQuotes,
    acceptedQuotes,
    confirmedOrders,
    draftDeliveries,
    quoteAmounts,
    orderAmounts,
  ] = await Promise.all([
    countBase().eq("document_type", "quote").eq("status", "draft"),
    countBase().eq("document_type", "quote").eq("status", "sent"),
    countBase().eq("document_type", "quote").eq("status", "accepted"),
    countBase().eq("document_type", "order").eq("status", "confirmed"),
    countBase().eq("document_type", "delivery_note").eq("status", "draft"),
    supabase
      .from("sales_documents")
      .select("total_ttc")
      .eq("organization_id", organizationId)
      .eq("document_type", "quote")
      .is("archived_at", null),
    supabase
      .from("sales_documents")
      .select("total_ttc")
      .eq("organization_id", organizationId)
      .eq("document_type", "order")
      .is("archived_at", null),
  ]);

  return {
    draftQuotes: draftQuotes.count ?? 0,
    sentQuotes: sentQuotes.count ?? 0,
    acceptedQuotes: acceptedQuotes.count ?? 0,
    confirmedOrders: confirmedOrders.count ?? 0,
    draftDeliveries: draftDeliveries.count ?? 0,
    quoteAmount: (quoteAmounts.data ?? []).reduce((sum, row) => sum + Number(row.total_ttc ?? 0), 0),
    orderAmount: (orderAmounts.data ?? []).reduce((sum, row) => sum + Number(row.total_ttc ?? 0), 0),
  };
}
