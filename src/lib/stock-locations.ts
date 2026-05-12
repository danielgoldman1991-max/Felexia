import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { StockLocationRecord, StockLocationType, WarehouseOption } from "@/lib/stock-types";
import { STOCK_LOCATION_TYPE_LABELS } from "@/lib/stock-types";

const STOCK_LOCATION_SELECT = `
  id, organization_id, name, code, location_type, parent_id, address, city, country,
  manager_name, phone, email, notes, is_default, status, created_at, updated_at, archived_at,
  parent:parent_id(name)
`;

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return Array.isArray(value) ? (value[0] as Record<string, unknown> | undefined) ?? null : value as Record<string, unknown>;
}

function mapStockLocation(raw: unknown): StockLocationRecord {
  const row = raw as Record<string, unknown>;
  const parent = objectValue(row.parent);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    code: (row.code as string) ?? null,
    location_type: ((row.location_type as StockLocationType | null) ?? "warehouse"),
    parent_id: (row.parent_id as string) ?? null,
    parent_name: (parent?.name as string | undefined) ?? null,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    country: (row.country as string) ?? null,
    manager_name: (row.manager_name as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    notes: (row.notes as string) ?? null,
    is_default: Boolean(row.is_default),
    status: (row.status as StockLocationRecord["status"]) ?? "active",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string) ?? null,
  };
}

export function getStockLocationTypeLabel(type: StockLocationType | string | null | undefined) {
  return type && type in STOCK_LOCATION_TYPE_LABELS ? STOCK_LOCATION_TYPE_LABELS[type as StockLocationType] : "Emplacement";
}

export async function listStockLocations(filters: { includeArchived?: boolean; status?: string } = {}): Promise<StockLocationRecord[]> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  let query = supabase
    .from("warehouses")
    .select(STOCK_LOCATION_SELECT)
    .eq("organization_id", workspace.organization.id)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (!filters.includeArchived) query = query.is("archived_at", null);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapStockLocation);
}

export async function listActiveStockLocations(): Promise<WarehouseOption[]> {
  const rows = await listStockLocations({ status: "active" });
  return rows.map((row) => ({
    id: row.id,
    name: row.is_default ? `${row.name} (par defaut)` : row.name,
    code: row.code,
    location_type: row.location_type,
    is_default: row.is_default,
  }));
}

export async function getStockLocationDetail(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const [locationResult, levelsResult, movesResult] = await Promise.all([
    supabase.from("warehouses").select(STOCK_LOCATION_SELECT).eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle(),
    supabase
      .from("stock_levels")
      .select("organization_id, warehouse_id, product_id, quantity, updated_at, product:product_id(sku, name, min_stock)")
      .eq("organization_id", workspace.organization.id)
      .eq("warehouse_id", id)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("stock_moves")
      .select("id, product_id, move_type, direction, quantity, movement_date, source_document_id, notes, product:product_id(name)")
      .eq("organization_id", workspace.organization.id)
      .eq("warehouse_id", id)
      .order("movement_date", { ascending: false })
      .limit(50),
  ]);

  if (locationResult.error) throw new Error(locationResult.error.message);
  if (levelsResult.error) throw new Error(levelsResult.error.message);
  if (movesResult.error) throw new Error(movesResult.error.message);

  return {
    location: locationResult.data ? mapStockLocation(locationResult.data) : null,
    stockLevels: (levelsResult.data ?? []).map((row) => {
      const product = objectValue((row as Record<string, unknown>).product);
      return {
        product_id: row.product_id as string,
        sku: (product?.sku as string | undefined) ?? null,
        product_name: (product?.name as string | undefined) ?? null,
        min_stock: Number(product?.min_stock ?? 0),
        quantity: Number(row.quantity ?? 0),
        updated_at: row.updated_at as string,
      };
    }),
    movements: (movesResult.data ?? []).map((row) => {
      const product = objectValue((row as Record<string, unknown>).product);
      return {
        id: row.id as string,
        product_name: (product?.name as string | undefined) ?? null,
        move_type: row.move_type as string,
        direction: row.direction as string,
        quantity: Number(row.quantity ?? 0),
        movement_date: row.movement_date as string,
        notes: (row.notes as string | null) ?? null,
      };
    }),
  };
}

export async function getDefaultStockLocationId(organizationId?: string): Promise<string> {
  const workspace = organizationId ? null : await requireActiveWorkspace();
  const orgId = organizationId ?? workspace?.organization.id;
  if (!orgId) throw new Error("Organisation introuvable.");
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("warehouses")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("warehouses")
    .insert({ organization_id: orgId, name: "Depot principal", code: "DEPOT-PRINCIPAL", location_type: "depot", is_default: true, status: "active" })
    .select("id")
    .single();
  if (createError || !created) throw new Error(createError?.message ?? "Impossible de creer l'emplacement par defaut.");
  return created.id as string;
}

export async function getStockLocationCounters() {
  const rows = await listStockLocations();
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    defaultLocation: rows.find((row) => row.is_default) ?? null,
  };
}
