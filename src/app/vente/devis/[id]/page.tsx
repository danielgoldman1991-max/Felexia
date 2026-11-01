import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SalesDocumentDetail } from "@/components/sales/sales-document-detail";
import { getSalesDocumentDetail, getSalesDocumentFlow } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const { id } = await params;
  const [{ document, lines }, documentFlow] = await Promise.all([
    getSalesDocumentDetail(id),
    getSalesDocumentFlow(id),
  ]);

  if (!document || document.document_type !== "quote") {
    notFound();
  }

  return (
    <ModulePage>
      <SalesDocumentDetail canWrite={canWrite} document={document} lines={lines} documentFlow={documentFlow} />
    </ModulePage>
  );
}
