import { notFound } from "next/navigation";
import { SalesOrderForm } from "@/components/sales/sales-order-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateSalesOrder } from "@/lib/sales-actions";
import {
  getDefaultSalesTaxRate,
  getSalesDocumentDetail,
  listSalesQuoteThirdParties,
  listSalesProducts,
  listSalesTaxRates,
  listSalesUnits,
} from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function EditSalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, customers, products, units, taxRates, defaultTaxRate] = await Promise.all([
    getSalesDocumentDetail(id),
    listSalesQuoteThirdParties(),
    listSalesProducts(),
    listSalesUnits(),
    listSalesTaxRates(),
    getDefaultSalesTaxRate(),
  ]);

  if (!document || document.document_type !== "order" || document.status !== "draft") {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier la commande" description={document.document_number} />
      <SalesOrderForm
        mode="edit"
        document={document}
        lines={lines}
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        defaultTaxRate={defaultTaxRate}
        action={updateSalesOrder}
      />
    </ModulePage>
  );
}
