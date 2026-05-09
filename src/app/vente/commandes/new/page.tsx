import { SalesOrderForm } from "@/components/sales/sales-order-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createSalesOrder } from "@/lib/sales-actions";
import {
  getDefaultSalesTaxRate,
  listSalesCustomers,
  listSalesProducts,
  listSalesTaxRates,
  listSalesUnits,
} from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function NewSalesOrderPage() {
  const [customers, products, units, taxRates, defaultTaxRate] = await Promise.all([
    listSalesCustomers(),
    listSalesProducts(),
    listSalesUnits(),
    listSalesTaxRates(),
    getDefaultSalesTaxRate(),
  ]);

  return (
    <ModulePage>
      <PageHeader title="Nouvelle commande" description="Creation directe d'une commande client." />
      <SalesOrderForm
        mode="create"
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        defaultTaxRate={defaultTaxRate}
        action={createSalesOrder}
      />
    </ModulePage>
  );
}
