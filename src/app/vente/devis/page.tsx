import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function VenteDevisPage() {
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const { rows } = await listSalesDocuments({ type: "quote" });

  return (
    <ModulePage>
      <PageHeader
        title="Devis"
        description="Propositions commerciales avant commande client."
        actions={canWrite ? <Button asChild><Link href="/vente/devis/new">Nouveau devis</Link></Button> : null}
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable canWrite={canWrite} rows={rows} type="quote" />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
