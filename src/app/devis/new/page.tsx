import { SalesQuoteForm } from "@/components/commerce/sales-quote-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createSalesQuote } from "@/lib/commerce-actions";
import { listCustomersForSelect, listProductsForSelect, listTaxRatesForSelect } from "@/lib/commerce";
import { listUnits } from "@/lib/products";

export default async function NewDevisPage() {
  const [customers, products, taxRates, units] = await Promise.all([
    listCustomersForSelect(),
    listProductsForSelect(),
    listTaxRatesForSelect(),
    listUnits(),
  ]);

  const defaultTaxRate = taxRates.find((t) => t.is_default) ?? taxRates.reduce((a, b) => (a.rate > b.rate ? a : b), taxRates[0]);

  return (
    <ModulePage>
      <PageHeader title="Nouveau devis" description="Numero genere automatiquement a la sauvegarde." />
      <SalesQuoteForm
        mode="create"
        action={createSalesQuote}
        customers={customers}
        products={products}
        taxRates={taxRates}
        units={units}
        defaultTaxRate={defaultTaxRate ? { id: defaultTaxRate.id, rate: defaultTaxRate.rate } : null}
      />
    </ModulePage>
  );
}
