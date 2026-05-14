import { notFound } from "next/navigation";
import { SupplierOrderPrintView } from "@/components/purchases/supplier-order-print-view";
import { getPurchaseDocumentDetail } from "@/lib/purchases";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";

export const dynamic = "force-dynamic";

export default async function SupplierOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getPurchaseDocumentDetail(id);
  if (!document || document.document_type !== "supplier_order") notFound();
  const identity = await getOrganizationDocumentIdentity(document.organization_id);
  return <SupplierOrderPrintView document={document} lines={lines} identity={identity} />;
}
