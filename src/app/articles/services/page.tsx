import Link from "next/link";
import { ProductRecordTable } from "@/components/articles/product-record-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/lib/products";

export default async function ServicesPage() {
  const { rows } = await listProducts({ type: "service", status: "all" });

  return (
    <ModulePage>
      <PageHeader
        title="Services"
        description="Services facturables sans suivi de stock."
        actions={<Link href="/articles/new?type=service"><Button>Nouveau service</Button></Link>}
      />
      <ProductRecordTable rows={rows} />
    </ModulePage>
  );
}
