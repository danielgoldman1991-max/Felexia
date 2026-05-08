import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function VenteDevisPage() {
  const { rows } = await listSalesDocuments({ type: "quote" });

  return (
    <ModulePage>
      <PageHeader
        title="Devis"
        description="Propositions commerciales avant commande client."
        actions={<Link href="/vente/devis/new"><Button>Nouveau devis</Button></Link>}
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable rows={rows} type="quote" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
