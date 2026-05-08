import Link from "next/link";
import { DeliveriesTable } from "@/components/commerce/deliveries-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listDeliveryNotes } from "@/lib/commerce";

export default async function LivraisonsPage() {
  const { rows } = await listDeliveryNotes({});

  return (
    <ModulePage>
      <PageHeader
        title="Bons de livraison"
        description="Sorties de stock uniquement apres validation."
        actions={<Link href="/livraisons/new"><Button>Nouveau bon de livraison</Button></Link>}
      />
      <DeliveriesTable rows={rows} />
    </ModulePage>
  );
}
