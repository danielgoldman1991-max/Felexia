import { DeliveryNoteForm } from "@/components/commerce/delivery-note-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createDeliveryNote } from "@/lib/commerce-actions";
import { listCustomersForSelect, listProductsForSelect, listTaxRatesForSelect } from "@/lib/commerce";
import { listUnits } from "@/lib/products";

export default async function NewLivraisonPage({
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
  const orderId = Array.isArray(params.order_id) ? params.order_id[0] : params.order_id;

  return (
    <ModulePage>
      <PageHeader title="Nouveau bon de livraison" description="Numero genere automatiquement a la sauvegarde." />
      <DeliveryNoteForm
        mode="create"
        action={createDeliveryNote}
        customers={customers}
        products={products}
        taxRates={taxRates}
        units={units}
        defaultTaxRate={defaultTaxRate ? { id: defaultTaxRate.id, rate: defaultTaxRate.rate } : null}
        orderId={orderId}
      />
    </ModulePage>
  );
}
