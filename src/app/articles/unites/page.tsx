import Link from "next/link";
import { UnitsTable } from "@/components/articles/units-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listUnits } from "@/lib/products";

export default async function UnitsPage() {
  const units = await listUnits();

  return (
    <ModulePage>
      <PageHeader
        title="Unites"
        description="Gestion des unites de vente, achat et stock."
        actions={<Link href="/articles/unites/new"><Button>Nouvelle unite</Button></Link>}
      />
      <UnitsTable rows={units} />
    </ModulePage>
  );
}
