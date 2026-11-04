import { requireProWorkspace } from "@/lib/pro-access";
import { listStockProductsForSelect } from "@/lib/stock";
import { listActiveStockLocations } from "@/lib/stock-locations";
import { transferStock } from "@/lib/stock-actions";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StockTransferForm } from "@/components/stock/stock-transfer-form";

export const dynamic = "force-dynamic";

export default async function StockTransferPage() {
  await requireProWorkspace({ write: false, module: "stock" });
  const [products, locations] = await Promise.all([
    listStockProductsForSelect(),
    listActiveStockLocations(),
  ]);
  return (
    <ModulePage>
      <PageHeader title="Transfert de stock" description="Déplace une quantité d'un emplacement vers un autre, sans changer le stock global." />
      <StockTransferForm action={transferStock} products={products.filter((product) => product.track_stock)} locations={locations} />
    </ModulePage>
  );
}
