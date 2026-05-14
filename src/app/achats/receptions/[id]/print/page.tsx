import { notFound } from "next/navigation";
import { SupplierReceiptPrintView } from "@/components/purchases/supplier-receipt-print-view";
import { getPurchaseDocumentDetail } from "@/lib/purchases";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";

export const dynamic = "force-dynamic";

export default async function SupplierReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getPurchaseDocumentDetail(id);
  if (!document || document.document_type !== "supplier_receipt") notFound();
  const identity = await getOrganizationDocumentIdentity(document.organization_id);
  return <SupplierReceiptPrintView document={document} lines={lines} identity={identity} />;
}
