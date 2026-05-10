import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { PurchaseDocumentsTable } from "@/components/purchases/purchase-documents-table";
import { listPurchaseDocuments } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierReceiptsPage() {
  const { rows } = await listPurchaseDocuments("supplier_receipt");
  return (
    <ModulePage>
      <PageHeader
        title="Receptions fournisseurs"
        description="Receptions de marchandises."
        actions={<Link href="/achats/receptions/new"><Button><Plus className="h-4 w-4" /> Nouvelle reception</Button></Link>}
      />
      <Card><CardContent><PurchaseDocumentsTable rows={rows} type="supplier_receipt" /></CardContent></Card>
    </ModulePage>
  );
}
