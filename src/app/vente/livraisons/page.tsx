import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
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
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const { rows } = await listSalesDocuments({ type: "delivery_note" });

  return (
    <ModulePage>
      <PageHeader
        title="Bons de livraison"
        description="Bons de livraison generes depuis les commandes clients."
        actions={canWrite ? (<Button type="button" asChild><Link href="/vente/livraisons/new">
              <Plus className="h-4 w-4" />
              Nouveau bon de livraison
            </Link></Button>) : null}
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable canWrite={canWrite} rows={rows} type="delivery_note" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
