import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SalesDocumentDetail } from "@/components/sales/sales-document-detail";
import { getSalesDocumentDetail } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getSalesDocumentDetail(id);

  if (!document || document.document_type !== "quote") {
    notFound();
  }

  return (
    <ModulePage>
      <SalesDocumentDetail document={document} lines={lines} />
    </ModulePage>
  );
}
