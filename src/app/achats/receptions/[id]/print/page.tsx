import { notFound } from "next/navigation";
import { SupplierReceiptPrintView } from "@/components/purchases/supplier-receipt-print-view";
import { getPurchaseDocumentDetail } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getPurchaseDocumentDetail(id);
  if (!document || document.document_type !== "supplier_receipt") notFound();
  return <SupplierReceiptPrintView document={document} lines={lines} />;
}
