import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierReceiptDetail } from "@/components/purchases/supplier-receipt-detail";
import { getPurchaseDocumentDetail, getPurchaseDocumentFlow, getSupplierInvoiceByReceiptId } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, documentFlow, existingInvoice] = await Promise.all([
    getPurchaseDocumentDetail(id),
    getPurchaseDocumentFlow(id),
    getSupplierInvoiceByReceiptId(id),
  ]);
  if (!document || document.document_type !== "supplier_receipt") notFound();
  return (
    <ModulePage>
      <SupplierReceiptDetail document={document} lines={lines} documentFlow={documentFlow} existingInvoice={existingInvoice} />
    </ModulePage>
  );
}
