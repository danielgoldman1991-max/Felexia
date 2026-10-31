import Link from "next/link";
import { ProductRecordTable } from "@/components/articles/product-record-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/lib/products";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function ArticlesPage() {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const { rows } = await listProducts({ status: "all" });

  return (
    <ModulePage>
      <PageHeader
        title="Articles et services"
        description="Un catalogue facultatif pour retrouver vos articles et services dans vos factures."
        actions={<Button asChild><Link href="/articles/new">Nouvel article</Link></Button>}
      />
      <ProductRecordTable rows={rows} fullAccess={fullAccess} />
    </ModulePage>
  );
}
