import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        description="Commandes directes et commandes creees depuis les devis."
        actions={
          <Link href="/vente/commandes/new">
            <Button type="button"><Plus className="h-4 w-4" /> Nouvelle commande</Button>
          </Link>
        }
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable rows={rows} type="order" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
