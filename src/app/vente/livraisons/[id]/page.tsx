import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SalesDocumentDetail } from "@/components/sales/sales-document-detail";
import { getSalesDocumentDetail, getSalesDocumentFlow } from "@/lib/sales";
import { getOrderBillingGuard } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function SalesDeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, documentFlow] = await Promise.all([
    getSalesDocumentDetail(id),
    getSalesDocumentFlow(id),
  ]);

  if (!document || document.document_type !== "delivery_note") {
    notFound();
  }

  const billingGuard = document.related_order_id
    ? await getOrderBillingGuard(document.organization_id, document.related_order_id)
    : null;

  return (
    <ModulePage>
      <SalesDocumentDetail document={document} lines={lines} documentFlow={documentFlow} billingGuard={billingGuard} />
    </ModulePage>
  );
}
