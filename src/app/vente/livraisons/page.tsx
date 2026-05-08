import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesDeliveriesPage() {
  const { rows } = await listSalesDocuments({ type: "delivery_note" });

  return (
    <ModulePage>
      <PageHeader
        title="Bons de livraison"
        description="Bons de livraison generes depuis les commandes clients."
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable rows={rows} type="delivery_note" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
