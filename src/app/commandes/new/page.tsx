import { SalesOrderForm } from "@/components/commerce/sales-order-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createSalesOrder } from "@/lib/commerce-actions";
import { listCustomersForSelect, listProductsForSelect, listTaxRatesForSelect } from "@/lib/commerce";
import { listUnits } from "@/lib/products";

export default async function NewCommandePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [customers, products, taxRates, units] = await Promise.all([
    listCustomersForSelect(),
    listProductsForSelect(),
    listTaxRatesForSelect(),
    listUnits(),
  ]);

  const defaultTaxRate = taxRates.find((t) => t.is_default) ?? taxRates.reduce((a, b) => (a.rate > b.rate ? a : b), taxRates[0]);
  const quoteId = Array.isArray(params.quote_id) ? params.quote_id[0] : params.quote_id;

  return (
    <ModulePage>
      <PageHeader title="Nouvelle commande client" description="Numero genere automatiquement a la sauvegarde." />
      <SalesOrderForm
        mode="create"
        action={createSalesOrder}
        customers={customers}
        products={products}
        taxRates={taxRates}
        units={units}
        defaultTaxRate={defaultTaxRate ? { id: defaultTaxRate.id, rate: defaultTaxRate.rate } : null}
        quoteId={quoteId}
      />
    </ModulePage>
  );
}
