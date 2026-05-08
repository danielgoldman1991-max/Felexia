import { notFound } from "next/navigation";
import { DeliveryNoteForm } from "@/components/commerce/delivery-note-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateDeliveryNote } from "@/lib/commerce-actions";
import { getDeliveryNoteDetail, listCustomersForSelect, listProductsForSelect, listTaxRatesForSelect } from "@/lib/commerce";
import { listUnits } from "@/lib/products";

export default async function EditLivraisonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ delivery, lines }, customers, products, taxRates, units] = await Promise.all([
    getDeliveryNoteDetail(id),
    listCustomersForSelect(),
    listProductsForSelect(),
    listTaxRatesForSelect(),
    listUnits(),
  ]);

  const defaultTaxRate = taxRates.find((t) => t.is_default) ?? taxRates.reduce((a, b) => (a.rate > b.rate ? a : b), taxRates[0]);

  if (!delivery) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier le bon de livraison" description={delivery.number ?? "Bon de livraison"} />
      <DeliveryNoteForm
        mode="edit"
        delivery={delivery}
        lines={lines}
        customers={customers}
        products={products}
        taxRates={taxRates}
        units={units}
        defaultTaxRate={defaultTaxRate ? { id: defaultTaxRate.id, rate: defaultTaxRate.rate } : null}
        action={updateDeliveryNote}
      />
    </ModulePage>
  );
}
