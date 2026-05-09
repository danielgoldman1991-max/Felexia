import { Badge } from "@/components/ui/badge";
import { STOCK_MOVE_TYPE_LABELS } from "@/lib/stock-types";
import type { StockMoveDirection, StockMoveType } from "@/lib/stock-types";

export function StockDirectionBadge({ direction }: { direction: StockMoveDirection }) {
  return (
    <Badge tone={direction === "in" ? "success" : "warning"}>
      {direction === "in" ? "Entree" : "Sortie"}
    </Badge>
  );
}

export function StockMoveTypeBadge({ type }: { type: StockMoveType }) {
  const tone = type === "customer_return_in"
    ? "info"
    : type.includes("adjustment")
      ? "neutral"
      : type.endsWith("_out")
        ? "warning"
        : "success";

  return <Badge tone={tone}>{STOCK_MOVE_TYPE_LABELS[type] ?? type}</Badge>;
}
