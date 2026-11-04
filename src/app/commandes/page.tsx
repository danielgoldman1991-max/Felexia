import Link from "next/link";
import { Plus } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function CommandesPage() {
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const { rows } = await listSalesDocuments({ type: "order" });

  return (
    <ModulePage>
      <PageHeader
        title="Commandes clients"
        description="Suivi des commandes confirmées, des livraisons et de la facturation."
        actions={canWrite ? <Button asChild><Link href="/vente/commandes/new"><Plus className="h-4 w-4" />Nouvelle commande</Link></Button> : null}
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable canWrite={canWrite} rows={rows} type="order" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
