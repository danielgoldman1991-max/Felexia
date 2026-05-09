import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  StockLevelRecord,
  StockMoveDirection,
  StockMovementFilters,
  StockMovementRecord,
  StockMoveType,
  StockProductOption,
  WarehouseOption,
} from "@/lib/stock-types";

const STOCK_PRODUCT_SELECT = `
  id, sku, barcode, name, unit_id, track_stock, current_stock, min_stock,
  status, archived_at,
  unit:unit_id (name, symbol)
`;

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return Array.isArray(value) ? (value[0] as Record<string, unknown> | undefined) ?? null : value as Record<string, unknown>;
}

function mapStockProduct(raw: unknown): StockProductOption {
  const row = raw as Record<string, unknown>;
  const unit = objectValue(row.unit);

  return {
    id: row.id as string,
    sku: (row.sku as string) ?? null,
    barcode: (row.barcode as string) ?? null,
    name: row.name as string,
    unit_id: (row.unit_id as string) ?? null,
    unit_name: (unit?.name as string | undefined) ?? null,
    unit_symbol: (unit?.symbol as string | undefined) ?? null,
    track_stock: Boolean(row.track_stock),
    current_stock: Number(row.current_stock ?? 0),
    min_stock: Number(row.min_stock ?? 0),
    status: (row.status as string) ?? null,
    archived_at: (row.archived_at as string) ?? null,
  };
}

function movementSign(direction: string) {
  return direction === "out" ? -1 : 1;
}

export async function listStockProductsForSelect(): Promise<StockProductOption[]> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(STOCK_PRODUCT_SELECT)
    .eq("organization_id", workspace.organization.id)
    .eq("type", "product")
    .eq("status", "active")
    .is("archived_at", null)
    .order("track_stock", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(mapStockProduct);
}

export async function listWarehouses(): Promise<WarehouseOption[]> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("organization_id", workspace.organization.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WarehouseOption[];
}

export async function getProductStockSummary(productId: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const [productResult, movementsResult, levelsResult] = await Promise.all([
    supabase
      .from("products")
      .select(STOCK_PRODUCT_SELECT)
      .eq("organization_id", workspace.organization.id)
      .eq("id", productId)
      .eq("type", "product")
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("stock_moves")
      .select("direction, quantity, movement_date")
      .eq("organization_id", workspace.organization.id)
      .eq("product_id", productId),
    supabase
      .from("stock_levels")
      .select("organization_id, warehouse_id, product_id, quantity, updated_at, warehouse:warehouse_id(name)")
      .eq("organization_id", workspace.organization.id)
      .eq("product_id", productId),
  ]);

  if (productResult.error) throw new Error(productResult.error.message);
  if (movementsResult.error) throw new Error(movementsResult.error.message);
  if (levelsResult.error) throw new Error(levelsResult.error.message);

  const product = productResult.data ? mapStockProduct(productResult.data) : null;
  const movements = movementsResult.data ?? [];
  const totalIn = movements
    .filter((move) => move.direction === "in")
    .reduce((sum, move) => sum + Number(move.quantity ?? 0), 0);
  const totalOut = movements
    .filter((move) => move.direction === "out")
    .reduce((sum, move) => sum + Number(move.quantity ?? 0), 0);
  const lastMovement = movements
    .map((move) => move.movement_date as string)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const stockLevels: StockLevelRecord[] = ((levelsResult.data ?? []) as unknown[]).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      organization_id: row.organization_id as string,
      warehouse_id: row.warehouse_id as string,
      product_id: row.product_id as string,
      quantity: Number(row.quantity ?? 0),
      updated_at: row.updated_at as string,
      warehouse_name: (objectValue(row.warehouse)?.name as string | undefined) ?? null,
    };
  });

  return {
    product,
    current_stock: product?.current_stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    total_in: totalIn,
    total_out: totalOut,
    net_quantity: totalIn - totalOut,
    movements_count: movements.length,
    last_movement_date: lastMovement,
    stock_levels: stockLevels,
  };
}

export async function listProductStockMovements(
  productId: string,
  filters: StockMovementFilters = {},
): Promise<StockMovementRecord[]> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  let query = supabase
    .from("stock_moves")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("product_id", productId)
    .order("movement_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters.dateFrom) query = query.gte("movement_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("movement_date", `${filters.dateTo}T23:59:59`);
  if (filters.moveType && filters.moveType !== "all") query = query.eq("move_type", filters.moveType);
  if (filters.direction && filters.direction !== "all") query = query.eq("direction", filters.direction);
  if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);

  const { data, error } = await query.limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const warehouseIds = Array.from(new Set(rows.map((row) => row.warehouse_id).filter(Boolean))) as string[];
  const documentIds = Array.from(new Set(rows.map((row) => row.source_document_id).filter(Boolean))) as string[];
  const userIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean))) as string[];

  const [warehousesResult, documentsResult, profilesResult] = await Promise.all([
    warehouseIds.length
      ? supabase.from("warehouses").select("id, name").eq("organization_id", workspace.organization.id).in("id", warehouseIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length
      ? supabase.from("sales_documents").select("id, document_number, document_type").eq("organization_id", workspace.organization.id).in("id", documentIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (warehousesResult.error) throw new Error(warehousesResult.error.message);
  if (documentsResult.error) throw new Error(documentsResult.error.message);
  if (profilesResult.error) throw new Error(profilesResult.error.message);

  const warehousesById = new Map((warehousesResult.data ?? []).map((row) => [row.id as string, row.name as string]));
  const documentsById = new Map((documentsResult.data ?? []).map((row) => [row.id as string, row]));
  const profilesById = new Map((profilesResult.data ?? []).map((row) => [row.id as string, row]));
  let balance = 0;

  return rows.map((row) => {
    const quantity = Number(row.quantity ?? 0);
    const direction: StockMoveDirection = row.direction === "out" ? "out" : "in";
    balance += movementSign(direction) * quantity;
    const sourceDocument = row.source_document_id ? documentsById.get(row.source_document_id as string) : null;
    const profile = row.created_by ? profilesById.get(row.created_by as string) : null;

    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      product_id: row.product_id as string,
      warehouse_id: (row.warehouse_id as string) ?? null,
      source_document_id: (row.source_document_id as string) ?? null,
      source_line_id: (row.source_line_id as string) ?? null,
      move_type: row.move_type as StockMoveType,
      direction,
      quantity,
      movement_date: row.movement_date as string,
      notes: (row.notes as string) ?? null,
      created_by: (row.created_by as string) ?? null,
      created_at: row.created_at as string,
      warehouse_name: row.warehouse_id ? warehousesById.get(row.warehouse_id as string) ?? null : null,
      source_document_number: (sourceDocument?.document_number as string | undefined) ?? null,
      source_document_type: (sourceDocument?.document_type as string | undefined) ?? null,
      created_by_name: profile ? ((profile.full_name as string | null) ?? (profile.email as string | null)) : null,
      balance_after: balance,
    };
  }).reverse();
}
