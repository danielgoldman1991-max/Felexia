import { notFound } from "next/navigation";
import { SupplierOrderPrintView } from "@/components/purchases/supplier-order-print-view";
import { getPurchaseDocumentDetail } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getPurchaseDocumentDetail(id);
  if (!document || document.document_type !== "supplier_order") notFound();
  return <SupplierOrderPrintView document={document} lines={lines} />;
}
