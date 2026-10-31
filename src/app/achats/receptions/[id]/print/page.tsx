import { notFound } from "next/navigation";
import { SupplierReceiptPrintView } from "@/components/purchases/supplier-receipt-print-view";
import { getPurchaseDocumentDetail } from "@/lib/purchases";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { PrintActions } from "@/components/sales/print-actions";

export const dynamic = "force-dynamic";

export default async function SupplierReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getPurchaseDocumentDetail(id);
  if (!document || document.document_type !== "supplier_receipt") notFound();
  const identity = await getOrganizationDocumentIdentity(document.organization_id);
  return <div className="print-preview"><PrintActions backHref={`/achats/receptions/${document.id}`} backLabel="Retour à la réception" /><SupplierReceiptPrintView document={document} lines={lines} identity={identity} /></div>;
}
