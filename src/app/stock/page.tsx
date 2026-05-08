import { ProductTable } from "@/components/erp/data-tables";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { products } from "@/lib/demo-data";

export default function StockPage() {
  return (
    <ModulePage>
      <PageHeader title="Stock" description="Niveaux de stock et alertes de reapprovisionnement." />
      <ProductTable rows={products.filter((product) => product.type === "product")} />
    </ModulePage>
  );
}
