import Link from "next/link";
import { ProductRecordTable } from "@/components/articles/product-record-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/lib/products";

export default async function ProductsPage() {
  const { rows } = await listProducts({ type: "product", status: "all" });

  return (
    <ModulePage>
      <PageHeader
        title="Produits"
        description="Articles stockes avec suivi de stock."
        actions={<Link href="/articles/new?type=product"><Button>Nouveau produit</Button></Link>}
      />
      <ProductRecordTable rows={rows} />
    </ModulePage>
  );
}
