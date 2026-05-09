import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { ProductStockSummary } from "@/components/stock/product-stock-summary";
import { StockMovementFilters } from "@/components/stock/stock-movement-filters";
import { StockMovementsTable } from "@/components/stock/stock-movements-table";
import { StockProductCombobox } from "@/components/stock/stock-product-combobox";
import {
  getProductStockSummary,
  listProductStockMovements,
  listStockProductsForSelect,
  listWarehouses,
} from "@/lib/stock";
import type { StockMoveDirection, StockMoveType } from "@/lib/stock-types";

export const dynamic = "force-dynamic";

type Search = {
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  moveType?: StockMoveType | "all";
  direction?: StockMoveDirection | "all";
  warehouseId?: string;
};

export default async function StockMovesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const products = await listStockProductsForSelect();
  const warehouses = await listWarehouses();
  const productId = params.productId ?? "";
  const summary = productId ? await getProductStockSummary(productId) : null;
  const movements = productId
    ? await listProductStockMovements(productId, {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        moveType: params.moveType,
        direction: params.direction,
        warehouseId: params.warehouseId,
      })
    : [];

  return (
    <ModulePage>
      <PageHeader
        title="Mouvements de stock par article"
        description="Consultez l'historique complet des entrees, sorties, retours et ajustements d'un article."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Article</h2>
          </CardHeader>
          <CardContent>
            <StockProductCombobox products={products} value={productId} />
          </CardContent>
        </Card>

        {!productId ? (
          <EmptyState title="Selectionnez un article" description="Choisissez un produit pour afficher son historique de stock." />
        ) : summary?.product ? (
          <>
            <ProductStockSummary summary={summary} />
            <StockMovementFilters
              productId={productId}
              warehouses={warehouses}
              values={{
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                moveType: params.moveType,
                direction: params.direction,
                warehouseId: params.warehouseId,
              }}
            />
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Historique des mouvements</h2>
              </CardHeader>
              <CardContent>
                <StockMovementsTable movements={movements} unitSymbol={summary.product.unit_symbol} />
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState title="Article introuvable" description="L'article selectionne est introuvable ou archive." />
        )}
      </div>
    </ModulePage>
  );
}
