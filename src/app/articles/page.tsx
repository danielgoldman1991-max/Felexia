import Link from "next/link";
import { ProductRecordTable } from "@/components/articles/product-record-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/lib/products";

export default async function ArticlesPage() {
  const { rows } = await listProducts({ status: "all" });

  return (
    <ModulePage>
      <PageHeader
        title="Articles et services"
        description="Catalogue commercial avec TVA, unites et suivi de stock."
        actions={<Link href="/articles/new"><Button>Nouvel article</Button></Link>}
      />
      <ProductRecordTable rows={rows} />
    </ModulePage>
  );
}
