import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StockOperationForm } from "@/components/stock/stock-operation-form";
import { createStockAdjustment } from "@/lib/stock-actions";
import { listStockProductsForSelect, listWarehouses } from "@/lib/stock";

export const dynamic = "force-dynamic";

export default async function NewStockAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const [{ productId }, products, warehouses] = await Promise.all([
    searchParams,
    listStockProductsForSelect(),
    listWarehouses(),
  ]);

  return (
    <ModulePage>
      <PageHeader
        title="Ajustement stock"
        description="Corrigez un ecart de stock avec un motif obligatoire et une trace historique."
      />
      <StockOperationForm
        mode="adjustment"
        products={products}
        warehouses={warehouses}
        initialProductId={productId}
        action={createStockAdjustment}
      />
    </ModulePage>
  );
}
