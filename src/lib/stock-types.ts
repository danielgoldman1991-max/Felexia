export type StockMoveDirection = "in" | "out";

export type StockLocationType =
  | "warehouse"
  | "depot"
  | "store"
  | "site"
  | "zone"
  | "rack"
  | "bin"
  | "vehicle"
  | "project"
  | "other";

export type StockLocationStatus = "active" | "inactive" | "archived";

export type StockLocationRecord = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  location_type: StockLocationType;
  parent_id: string | null;
  parent_name?: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_default: boolean;
  status: StockLocationStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type StockMoveType =
  | "delivery_out"
  | "customer_return_in"
  | "adjustment_in"
  | "adjustment_out"
  | "manual_stock_in"
  | "manual_stock_out"
  | "initial_stock"
  | "purchase_in"
  | "purchase_receipt_in";

export type StockProductOption = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  unit_id: string | null;
  unit_name: string | null;
  unit_symbol: string | null;
  track_stock: boolean;
  current_stock: number;
  min_stock: number;
  status: string | null;
  archived_at: string | null;
};

export type StockLevelRecord = {
  organization_id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
  warehouse_name: string | null;
};

export type StockMovementRecord = {
  id: string;
  organization_id: string;
  product_id: string;
  warehouse_id: string | null;
  source_document_id: string | null;
  source_line_id: string | null;
  move_type: StockMoveType;
  direction: StockMoveDirection;
  quantity: number;
  movement_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  warehouse_name: string | null;
  source_document_number: string | null;
  source_document_type: string | null;
  created_by_name: string | null;
  balance_after: number;
};

export type StockMovementFilters = {
  dateFrom?: string;
  dateTo?: string;
  moveType?: StockMoveType | "all";
  direction?: StockMoveDirection | "all";
  warehouseId?: string;
};

export type StockMovementSummary = {
  product: StockProductOption | null;
  current_stock: number;
  min_stock: number;
  total_in: number;
  total_out: number;
  net_quantity: number;
  movements_count: number;
  last_movement_date: string | null;
  stock_levels: StockLevelRecord[];
};

export type WarehouseOption = {
  id: string;
  name: string;
  code?: string | null;
  location_type?: StockLocationType;
  is_default?: boolean;
};

export type StockActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export const STOCK_MOVE_TYPE_LABELS: Record<StockMoveType, string> = {
  delivery_out: "Sortie BL client",
  customer_return_in: "Retour client",
  adjustment_in: "Ajustement positif",
  adjustment_out: "Ajustement negatif",
  manual_stock_in: "Entree manuelle",
  manual_stock_out: "Sortie manuelle",
  initial_stock: "Stock initial",
  purchase_in: "Entree achat",
  purchase_receipt_in: "Reception fournisseur",
};

export const STOCK_LOCATION_TYPE_LABELS: Record<StockLocationType, string> = {
  warehouse: "Entrepot",
  depot: "Depot",
  store: "Magasin",
  site: "Site",
  zone: "Zone",
  rack: "Rayonnage",
  bin: "Emplacement",
  vehicle: "Vehicule",
  project: "Chantier",
  other: "Autre",
};

export const STOCK_LOCATION_STATUS_LABELS: Record<StockLocationStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
  archived: "Archive",
};
