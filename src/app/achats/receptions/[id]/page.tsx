import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierReceiptDetail } from "@/components/purchases/supplier-receipt-detail";
import { getPurchaseDocumentDetail, getPurchaseDocumentFlow, getPurchaseReceiptArchiveEligibility, getSupplierInvoiceByReceiptId, getStockMovesForReceipt } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, documentFlow, existingInvoice, archiveEligibility, stockMoves] = await Promise.all([
    getPurchaseDocumentDetail(id),
    getPurchaseDocumentFlow(id),
    getSupplierInvoiceByReceiptId(id),
    getPurchaseReceiptArchiveEligibility(id),
    getStockMovesForReceipt(id),
  ]);
  if (!document || document.document_type !== "supplier_receipt") notFound();
  return (
    <ModulePage>
      <SupplierReceiptDetail
        document={document}
        lines={lines}
        documentFlow={documentFlow}
        existingInvoice={existingInvoice}
        archiveEligibility={archiveEligibility}
        stockMoves={stockMoves}
      />
    </ModulePage>
  );
}
