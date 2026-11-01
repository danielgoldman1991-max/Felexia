import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierOrderDetail } from "@/components/purchases/supplier-order-detail";
import { getPurchaseDocumentDetail, getPurchaseDocumentFlow } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const { id } = await params;
  const [{ document, lines }, documentFlow] = await Promise.all([
    getPurchaseDocumentDetail(id),
    getPurchaseDocumentFlow(id),
  ]);
  if (!document || document.document_type !== "supplier_order") notFound();
  return (
    <ModulePage>
      <SupplierOrderDetail canWrite={canWrite} document={document} lines={lines} documentFlow={documentFlow} />
    </ModulePage>
  );
}
