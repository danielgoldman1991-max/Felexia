import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierOrderDetail } from "@/components/purchases/supplier-order-detail";
import { getPurchaseDocumentDetail, getPurchaseDocumentFlow } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, documentFlow] = await Promise.all([
    getPurchaseDocumentDetail(id),
    getPurchaseDocumentFlow(id),
  ]);
  if (!document || document.document_type !== "supplier_order") notFound();
  return (
    <ModulePage>
      <SupplierOrderDetail document={document} lines={lines} documentFlow={documentFlow} />
    </ModulePage>
  );
}
