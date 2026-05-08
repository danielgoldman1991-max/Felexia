import { notFound } from "next/navigation";
import { SalesOrderForm } from "@/components/commerce/sales-order-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateSalesOrder } from "@/lib/commerce-actions";
import { getSalesOrderDetail, listCustomersForSelect, listProductsForSelect, listTaxRatesForSelect } from "@/lib/commerce";
import { listUnits } from "@/lib/products";

export default async function EditCommandePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ order, lines }, customers, products, taxRates, units] = await Promise.all([
    getSalesOrderDetail(id),
    listCustomersForSelect(),
    listProductsForSelect(),
    listTaxRatesForSelect(),
    listUnits(),
  ]);

  const defaultTaxRate = taxRates.find((t) => t.is_default) ?? taxRates.reduce((a, b) => (a.rate > b.rate ? a : b), taxRates[0]);

  if (!order) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier la commande" description={order.number ?? "Commande"} />
      <SalesOrderForm
        mode="edit"
        order={order}
        lines={lines}
        customers={customers}
        products={products}
        taxRates={taxRates}
        units={units}
        defaultTaxRate={defaultTaxRate ? { id: defaultTaxRate.id, rate: defaultTaxRate.rate } : null}
        action={updateSalesOrder}
      />
    </ModulePage>
  );
}
