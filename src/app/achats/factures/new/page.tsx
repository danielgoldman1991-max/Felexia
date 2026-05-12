import { redirect } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierInvoiceForm } from "@/components/purchases/supplier-invoice-form";
import { listPurchaseSuppliers, listPurchaseProducts, listBillableSupplierReceipts, getSupplierInvoiceByReceiptId } from "@/lib/purchases";
import type { SupplierInvoiceLineFormValue } from "@/lib/purchase-types";

export const dynamic = "force-dynamic";

export default async function NewSupplierInvoicePage({ searchParams }: { searchParams: Promise<{ receiptId?: string }> }) {
  const { receiptId } = await searchParams;

  if (receiptId) {
    const existing = await getSupplierInvoiceByReceiptId(receiptId);
    if (existing) redirect(`/achats/factures/${existing.id}`);
  }

  const [suppliers, products, billableReceipts] = await Promise.all([listPurchaseSuppliers(), listPurchaseProducts(), listBillableSupplierReceipts()]);

  let prefillSupplierId = "";
  let prefillSourceReceiptId = "";
  let prefillLines: SupplierInvoiceLineFormValue[] = [];

  if (receiptId) {
    const receipt = billableReceipts.find((r) => r.id === receiptId && !r.already_invoiced);
    if (receipt) {
      prefillSupplierId = receipt.supplier_id;
      prefillSourceReceiptId = receiptId;
      prefillLines = receipt.lines.map((l) => ({
        id: l.id,
        mode: "product" as const,
        product_id: l.product_id ?? "",
        product_name: l.product_name ?? "",
        description: l.description,
        quantity: l.quantity,
        unit_id: l.unit_id ?? "",
        unit_name: l.unit_name ?? "",
        unit_price_ht: l.unit_price_ht,
        discount_rate: l.discount_rate,
        tax_rate_id: l.tax_rate_id ?? "",
        tax_rate: l.tax_rate,
        subtotal_ht: l.quantity * l.unit_price_ht,
        discount_amount: 0,
        tax_amount: 0,
        total_ttc: l.quantity * l.unit_price_ht,
        source_line_id: l.id,
        source_document_id: receiptId,
      }));
    }
  }

  return (
    <ModulePage>
      <SupplierInvoiceForm suppliers={suppliers} products={products} billableReceipts={billableReceipts} prefillSupplierId={prefillSupplierId} prefillSourceReceiptId={prefillSourceReceiptId} prefillLines={prefillLines} />
    </ModulePage>
  );
}
