import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerInvoiceForm } from "@/components/invoices/customer-invoice-form";
import { Card, CardContent } from "@/components/ui/card";
import { createCustomerInvoice } from "@/lib/invoice-actions";
import {
  getDeliveryNotesInvoicePreparation,
  listBillableDeliveryNotesByCustomer,
  listInvoiceCustomers,
  listInvoiceProducts,
  listInvoiceTaxRates,
  listInvoiceUnits,
} from "@/lib/invoices";
import type { InvoiceLineFormValue } from "@/lib/invoice-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  sourceType?: "order" | "delivery_note" | "manual";
  sourceId?: string;
  customerId?: string;
  deliveryNoteId?: string;
}>;

type OrderPreparation = {
  document: {
    id: string;
    document_number: string;
    customer_id: string;
    related_order_id: string | null;
  };
  lines: InvoiceLineFormValue[];
};

function isOrderPreparation(value: unknown): value is OrderPreparation {
  return Boolean(value && typeof value === "object" && "document" in value);
}

export default async function NewCustomerInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sourceType = params.sourceType ?? "manual";
  const sourceId = params.sourceId ?? "";
  const initialCustomerId = params.customerId ?? "";
  const initialDeliveryNoteId = params.deliveryNoteId ?? (sourceType === "delivery_note" ? sourceId : "");

  if (sourceType === "order") {
    return (
      <ModulePage>
        <PageHeader title="Nouvelle facture" description="Facturation depuis bon de livraison validé uniquement." />
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="text-sm text-amber-800">
            Facturation directe depuis commande désactivée. Créez d’abord un bon de livraison validé, puis facturez le BL.
          </CardContent>
        </Card>
      </ModulePage>
    );
  }

  const [customers, products, units, taxRates, sourcePreparation] = await Promise.all([
    listInvoiceCustomers(),
    listInvoiceProducts(),
    listInvoiceUnits(),
    listInvoiceTaxRates(),
    initialCustomerId && initialDeliveryNoteId
        ? getDeliveryNotesInvoicePreparation(initialCustomerId, [initialDeliveryNoteId])
        : Promise.resolve(null),
  ]);

  const orderSourceDocument = isOrderPreparation(sourcePreparation) ? sourcePreparation.document : null;
  const initialLines = sourcePreparation?.lines ?? [];
  const initialCustomer = orderSourceDocument?.customer_id ?? initialCustomerId;
  const initialDeliveryNotes = initialCustomer ? await listBillableDeliveryNotesByCustomer(initialCustomer) : [];

  return (
    <ModulePage>
      <PageHeader title="Nouvelle facture" description="Selectionnez d'abord un client, puis importez ses BL valides a facturer." />

      <CustomerInvoiceForm
        action={createCustomerInvoice}
        customers={customers}
        products={products}
        units={units}
        taxRates={taxRates}
        initialCustomerId={initialCustomer}
        initialLines={initialLines}
        initialDeliveryNotes={initialDeliveryNotes}
        initialSelectedDeliveryNoteIds={initialDeliveryNoteId ? [initialDeliveryNoteId] : []}
        sourceType={sourceType}
        sourceDocumentId={orderSourceDocument?.id ?? initialDeliveryNoteId}
        sourceOrderId={orderSourceDocument?.related_order_id ?? ""}
        sourceDeliveryId={initialDeliveryNoteId}
      />
    </ModulePage>
  );
}
