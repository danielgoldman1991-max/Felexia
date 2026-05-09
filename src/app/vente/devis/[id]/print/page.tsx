import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { SalesQuotePrintView } from "@/components/sales/sales-quote-print-view";
import { getSalesDocumentDetail } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SalesQuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getSalesDocumentDetail(id);

  if (!document || document.document_type !== "quote") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-100 py-4 print:bg-white print:py-0">
      <PrintActions backHref={`/vente/devis/${document.id}`} backLabel="Retour au devis" />
      <SalesQuotePrintView document={document} lines={lines} />
    </div>
  );
}
