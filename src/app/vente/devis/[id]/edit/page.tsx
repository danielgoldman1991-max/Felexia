import { notFound } from "next/navigation";
import { SalesQuoteForm } from "@/components/sales/sales-quote-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateSalesQuote } from "@/lib/sales-actions";
import {
  getDefaultSalesTaxRate,
  getSalesDocumentDetail,
  listSalesQuoteThirdParties,
  listSalesProducts,
  listSalesTaxRates,
  listSalesUnits,
} from "@/lib/sales";
import { listProductCategories, listUnits, listTaxRates } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function EditSalesQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ document, lines }, customers, products, units, taxRates, defaultTaxRate, productCategories, fullUnits, fullTaxRates] = await Promise.all([
    getSalesDocumentDetail(id),
    listSalesQuoteThirdParties(),
    listSalesProducts(),
    listSalesUnits(),
    listSalesTaxRates(),
    getDefaultSalesTaxRate(),
    listProductCategories(),
    listUnits(),
    listTaxRates(),
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
        productCategories={productCategories}
        allUnits={fullUnits}
        allTaxRates={fullTaxRates}
      />
    </ModulePage>
  );
}
