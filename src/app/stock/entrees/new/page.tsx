import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StockOperationForm } from "@/components/stock/stock-operation-form";
import { createManualStockEntry } from "@/lib/stock-actions";
import { listStockProductsForSelect, listWarehouses } from "@/lib/stock";

export const dynamic = "force-dynamic";

export default async function NewStockEntryPage({
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
        title="Entree manuelle de stock"
        description="Ajoutez une entree de stock rattachee au depot principal ou a un depot existant."
      />
      <StockOperationForm
        mode="entry"
        products={products}
        warehouses={warehouses}
        initialProductId={productId}
        action={createManualStockEntry}
      />
    </ModulePage>
  );
}
