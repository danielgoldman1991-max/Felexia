import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { SalesQuotePrintView } from "@/components/sales/sales-quote-print-view";
import { getSalesDocumentDetail } from "@/lib/sales";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";

export const dynamic = "force-dynamic";

export default async function SalesReturnPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getSalesDocumentDetail(id);

  if (!document || document.document_type !== "return_note") {
    notFound();
  }

  const identity = await getOrganizationDocumentIdentity(document.organization_id);

  return (
    <div className="min-h-screen bg-slate-100 py-4 print:bg-white print:py-0">
      <PrintActions backHref={`/vente/retours/${document.id}`} backLabel="Retour au retour" />
      <SalesQuotePrintView document={document} lines={lines} identity={identity} title="BON DE RETOUR" showSignature />
    </div>
  );
}
