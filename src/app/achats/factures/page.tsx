import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SupplierInvoicesTable } from "@/components/purchases/purchase-documents-table";
import { listSupplierInvoices } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicesPage() {
  const { rows } = await listSupplierInvoices();
  return (
    <ModulePage>
      <PageHeader
        title="Factures fournisseurs"
        description="Factures recues des fournisseurs."
        actions={<Button asChild><Link href="/achats/factures/new"><Plus className="h-4 w-4" /> Nouvelle facture</Link></Button>}
      />
      <Card><CardContent><SupplierInvoicesTable rows={rows} /></CardContent></Card>
    </ModulePage>
  );
}
