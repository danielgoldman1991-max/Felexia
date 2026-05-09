import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
        actions={(
          <Link href="/vente/livraisons/new">
            <Button type="button">
              <Plus className="h-4 w-4" />
              Nouveau bon de livraison
            </Button>
          </Link>
        )}
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable rows={rows} type="delivery_note" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
