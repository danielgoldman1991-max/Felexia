import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage() {
  const { rows } = await listSalesDocuments({ type: "order" });

  return (
    <ModulePage>
      <PageHeader
        title="Commandes clients"
        description="Commandes creees depuis des devis acceptes ou convertis."
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable rows={rows} type="order" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
