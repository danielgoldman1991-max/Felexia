import Link from "next/link";
import { OrdersTable } from "@/components/commerce/orders-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listSalesOrders } from "@/lib/commerce";

export default async function CommandesPage() {
  const { rows } = await listSalesOrders({});

  return (
    <ModulePage>
      <PageHeader
        title="Commandes clients"
        description="Suivi des commandes confirmées, des livraisons et de la facturation."
        actions={<Button asChild><Link href="/commandes/new">Nouvelle commande</Link></Button>}
      />
      <OrdersTable rows={rows} />
    </ModulePage>
  );
}
