import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { PurchaseDocumentsTable } from "@/components/purchases/purchase-documents-table";
import { listPurchaseDocuments } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierOrdersPage() {
  const { rows } = await listPurchaseDocuments("supplier_order");
  return (
    <ModulePage>
      <PageHeader
        title="Commandes fournisseurs"
        description="Commandes passees aux fournisseurs."
        actions={<Button asChild><Link href="/achats/commandes/new"><Plus className="h-4 w-4" /> Nouvelle commande</Link></Button>}
      />
      <Card><CardContent><PurchaseDocumentsTable rows={rows} type="supplier_order" /></CardContent></Card>
    </ModulePage>
  );
}
