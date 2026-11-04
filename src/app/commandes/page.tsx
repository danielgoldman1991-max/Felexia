import Link from "next/link";
import { Plus } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SalesDocumentsTable } from "@/components/sales/sales-documents-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListPagination } from "@/components/erp/list-pagination";
import { listSalesDocuments } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function CommandesPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const page = Number(params.page || 1);
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const result = await listSalesDocuments({ type: "order", page: Number.isFinite(page) ? page : 1 });

  return (
    <ModulePage>
      <PageHeader
        title="Commandes clients"
        description="Suivi des commandes confirmées, des livraisons et de la facturation."
        actions={canWrite ? <Button asChild><Link href="/vente/commandes/new"><Plus className="h-4 w-4" />Nouvelle commande</Link></Button> : null}
      />
      <Card>
        <CardContent>
          <SalesDocumentsTable canWrite={canWrite} rows={result.rows} type="order" />
          <ListPagination page={result.page} totalPages={result.totalPages} total={result.total} params={params} />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
