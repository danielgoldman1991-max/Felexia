import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { STOCK_MOVE_TYPE_LABELS } from "@/lib/stock-types";
import type { StockMoveType, WarehouseOption } from "@/lib/stock-types";

const moveTypes = Object.keys(STOCK_MOVE_TYPE_LABELS) as StockMoveType[];

export function StockMovementFilters({
  productId,
  warehouses,
  values,
}: {
  productId: string;
  warehouses: WarehouseOption[];
  values: Record<string, string | undefined>;
}) {
  return (
    <form className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
      <input type="hidden" name="productId" value={productId} />
      <DateField name="dateFrom" defaultValue={values.dateFrom ?? ""} />
      <DateField name="dateTo" defaultValue={values.dateTo ?? ""} />
      <Select name="moveType" defaultValue={values.moveType ?? "all"}>
        <option value="all">Tous les types</option>
        {moveTypes.map((type) => (
          <option key={type} value={type}>{STOCK_MOVE_TYPE_LABELS[type]}</option>
        ))}
      </Select>
      <Select name="direction" defaultValue={values.direction ?? "all"}>
        <option value="all">Entrees et sorties</option>
        <option value="in">Entrees</option>
        <option value="out">Sorties</option>
      </Select>
      <Select name="warehouseId" defaultValue={values.warehouseId ?? ""}>
        <option value="">Tous les depots</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
        ))}
      </Select>
      <Button type="submit">Filtrer</Button>
    </form>
  );
}
