import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SalesDocumentDetail } from "@/components/sales/sales-document-detail";
import { getCreditNoteByReturnId } from "@/lib/credit-notes";
import { getSalesDocumentDetail, getSalesDocumentFlow } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, documentFlow] = await Promise.all([
    getSalesDocumentDetail(id),
    getSalesDocumentFlow(id),
  ]);

  if (!document || document.document_type !== "return_note") {
    notFound();
  }

  const returnCreditNote = await getCreditNoteByReturnId(id);

  return (
    <ModulePage>
      <SalesDocumentDetail document={document} lines={lines} returnCreditNote={returnCreditNote} documentFlow={documentFlow} />
    </ModulePage>
  );
}
