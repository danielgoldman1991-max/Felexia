import { notFound } from "next/navigation";
import { DeliveryNoteDetail } from "@/components/commerce/delivery-note-detail";
import { ModulePage } from "@/components/erp/module-page";
import { getDeliveryNoteDetail } from "@/lib/commerce";

export default async function LivraisonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { delivery, lines } = await getDeliveryNoteDetail(id);

  if (!delivery) {
    notFound();
  }

  return (
    <ModulePage>
      <DeliveryNoteDetail delivery={delivery} lines={lines} />
    </ModulePage>
  );
}
