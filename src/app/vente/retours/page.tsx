import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesReturnsPage() {
  const { rows } = await listSalesDocuments({ type: "return_note" });

  return (
    <ModulePage>
      <PageHeader
        title="Retours client"
        description="Bons de retour crees depuis les livraisons client."
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable rows={rows} type="return_note" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
