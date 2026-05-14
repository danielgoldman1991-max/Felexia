import { SalesQuoteForm } from "@/components/sales/sales-quote-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createSalesQuote } from "@/lib/sales-actions";
import {
  getDefaultSalesTaxRate,
  listSalesQuoteThirdParties,
  listSalesProducts,
  listSalesTaxRates,
  listSalesUnits,
} from "@/lib/sales";
import { listProductCategories, listUnits, listTaxRates } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function NewSalesQuotePage() {
  const [customers, products, units, taxRates, defaultTaxRate, productCategories, fullUnits, fullTaxRates] = await Promise.all([
    listSalesQuoteThirdParties(),
    listSalesProducts(),
    listSalesUnits(),
    listSalesTaxRates(),
    getDefaultSalesTaxRate(),
    listProductCategories(),
    listUnits(),
    listTaxRates(),
  ]);

  return (
    <ModulePage>
      <PageHeader title="Nouveau devis" description="Creation d'un devis client avec lignes commerciales." />
      <SalesQuoteForm
        mode="create"
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        defaultTaxRate={defaultTaxRate}
        action={createSalesQuote}
        productCategories={productCategories}
        allUnits={fullUnits}
        allTaxRates={fullTaxRates}
      />
    </ModulePage>
  );
}
