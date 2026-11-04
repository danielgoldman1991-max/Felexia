import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function DevisPage() {
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const { rows } = await listSalesDocuments({ type: "quote" });

  return (
    <ModulePage>
      <PageHeader
        title="Devis"
        description="Propositions commerciales avant commande et facturation."
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
