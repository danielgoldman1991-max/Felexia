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
        description="Suivi des commandes confirmees, livraisons et facturation."
        actions={<Link href="/commandes/new"><Button>Nouvelle commande</Button></Link>}
      />
      <OrdersTable rows={rows} />
    </ModulePage>
  );
}
