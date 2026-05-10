import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SuppliersTable } from "@/components/purchases/suppliers-table";
import { listPurchaseSuppliers } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function PurchaseSuppliersPage() {
  const suppliers = await listPurchaseSuppliers();
  return (
    <ModulePage>
      <PageHeader
        title="Fournisseurs"
        description="Tiers fournisseurs actifs."
        actions={<Link href="/tiers/new?type=supplier"><Button><Plus className="h-4 w-4" /> Nouveau fournisseur</Button></Link>}
      />
      <Card><CardContent><SuppliersTable rows={suppliers} /></CardContent></Card>
    </ModulePage>
  );
}
