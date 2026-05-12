import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SalesDocumentDetail } from "@/components/sales/sales-document-detail";
import { getSalesDocumentDetail, getSalesDocumentFlow } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, documentFlow] = await Promise.all([
    getSalesDocumentDetail(id),
    getSalesDocumentFlow(id),
  ]);

  if (!document || document.document_type !== "order") {
    notFound();
  }

  return (
    <ModulePage>
      <SalesDocumentDetail document={document} lines={lines} documentFlow={documentFlow} />
    </ModulePage>
  );
}
