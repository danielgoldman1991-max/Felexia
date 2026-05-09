import { notFound } from "next/navigation";
import { DeliveryNoteForm } from "@/components/sales/delivery-note-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createManualDeliveryNote } from "@/lib/sales-actions";
import { getManualDeliveryPreparation } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function DeliverSalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { order, lines } = await getManualDeliveryPreparation(id);

  if (!order || !["confirmed", "partially_delivered"].includes(order.status)) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader
        title="Creer une livraison"
        description={`Commande ${order.document_number}`}
      />
      <DeliveryNoteForm order={order} lines={lines} action={createManualDeliveryNote} />
    </ModulePage>
  );
}
