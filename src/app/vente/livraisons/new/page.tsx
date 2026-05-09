import { DeliveryNoteForm } from "@/components/sales/delivery-note-form";
import { DeliveryOrderSelector } from "@/components/sales/delivery-order-selector";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createManualDeliveryNote } from "@/lib/sales-actions";
import { getManualDeliveryPreparation, listDeliverableOrders } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function NewDeliveryNotePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const orders = await listDeliverableOrders();
  const preparation = orderId ? await getManualDeliveryPreparation(orderId) : null;
  const order = preparation?.order ?? null;

  return (
    <ModulePage>
      <PageHeader
        title="Nouveau bon de livraison"
        description="Choisissez une commande, ajustez les quantites a livrer, puis creez un BL brouillon."
      />

      <div className="space-y-5">
        <DeliveryOrderSelector orders={orders} selectedOrderId={orderId} />

        {order && ["confirmed", "partially_delivered"].includes(order.status) ? (
          <DeliveryNoteForm order={order} lines={preparation?.lines ?? []} action={createManualDeliveryNote} />
        ) : orderId ? (
          <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Cette commande n&apos;est pas eligible a la livraison ou ne contient plus de reliquat.
          </div>
        ) : null}
      </div>
    </ModulePage>
  );
}
