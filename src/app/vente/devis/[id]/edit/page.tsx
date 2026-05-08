import { notFound } from "next/navigation";
import { SalesQuoteForm } from "@/components/sales/sales-quote-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateSalesQuote } from "@/lib/sales-actions";
import {
  getDefaultSalesTaxRate,
  getSalesDocumentDetail,
  listSalesCustomers,
  listSalesProducts,
  listSalesTaxRates,
  listSalesUnits,
} from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function EditSalesQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, customers, products, units, taxRates, defaultTaxRate] = await Promise.all([
    getSalesDocumentDetail(id),
    listSalesCustomers(),
    listSalesProducts(),
    listSalesUnits(),
    listSalesTaxRates(),
    getDefaultSalesTaxRate(),
  ]);

  if (!document || document.document_type !== "quote") {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier le devis" description={document.document_number} />
      <SalesQuoteForm
        mode="edit"
        document={document}
        lines={lines}
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        defaultTaxRate={defaultTaxRate}
        action={updateSalesQuote}
      />
    </ModulePage>
  );
}
