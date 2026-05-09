import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/erp/stat-card";
import { formatDate, formatNumber } from "@/lib/format";
import type { StockMovementSummary } from "@/lib/stock-types";

export function ProductStockSummary({ summary }: { summary: StockMovementSummary }) {
  const product = summary.product;
  if (!product) return null;

  return (
    <div className="space-y-5">
      {!product.track_stock ? (
        <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cet article n&apos;est pas suivi en stock. Les mouvements restent consultables, mais le stock doit etre interprete avec prudence.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Stock actuel" value={`${formatNumber(summary.current_stock)} ${product.unit_symbol ?? ""}`} />
        <StatCard title="Stock minimum" value={formatNumber(summary.min_stock)} />
        <StatCard title="Total entrees" value={formatNumber(summary.total_in)} />
        <StatCard title="Total sorties" value={formatNumber(summary.total_out)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{product.name}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {product.sku ?? "Sans SKU"} · Unite {product.unit_symbol ?? "-"} · {summary.movements_count} mouvement(s)
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/stock/entrees/new?productId=${product.id}`}>
                <Button type="button" variant="secondary">Entree stock</Button>
              </Link>
              <Link href={`/stock/ajustements/new?productId=${product.id}`}>
                <Button type="button" variant="secondary">Ajuster</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-[var(--muted)]">Dernier mouvement</p>
            <p className="mt-1 text-sm">{summary.last_movement_date ? formatDate(summary.last_movement_date) : "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-[var(--muted)]">Solde net mouvements</p>
            <p className="mt-1 text-sm">{formatNumber(summary.net_quantity)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-medium uppercase text-[var(--muted)]">Stock par depot</p>
            <div className="mt-1 flex flex-wrap gap-2 text-sm">
              {summary.stock_levels.length > 0 ? summary.stock_levels.map((level) => (
                <span key={`${level.warehouse_id}-${level.product_id}`} className="rounded-full bg-[var(--surface-soft)] px-3 py-1">
                  {level.warehouse_name ?? "Depot"} : {formatNumber(level.quantity)} {product.unit_symbol ?? ""}
                </span>
              )) : "-"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
