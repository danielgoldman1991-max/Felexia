import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerInvoiceForm } from "@/components/invoices/customer-invoice-form";
import { Card, CardContent } from "@/components/ui/card";
import { createCustomerInvoice } from "@/lib/invoice-actions";
import {
  getDeliveryNotesInvoicePreparation,
  getOrderInvoicePreparation,
  listBillableDeliveryNotesByCustomer,
  listInvoiceCustomers,
  listInvoiceProducts,
  listInvoiceTaxRates,
  listInvoiceUnits,
} from "@/lib/invoices";
import type { InvoiceLineFormValue } from "@/lib/invoice-types";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

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
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const sourceType = fullAccess ? params.sourceType ?? "manual" : "manual";
  const sourceId = fullAccess ? params.sourceId ?? "" : "";
  const initialCustomerId = params.customerId ?? "";
  const initialDeliveryNoteId = fullAccess ? params.deliveryNoteId ?? (sourceType === "delivery_note" ? sourceId : "") : "";

  if (sourceType === "order") {
    if (!sourceId) {
      return (
        <ModulePage>
          <PageHeader title="Nouvelle facture" description="Choisissez une commande confirmée sans bon de livraison." />
          <Card className="border-amber-200 bg-amber-50"><CardContent className="text-sm text-amber-800">Aucune commande n’a été sélectionnée.</CardContent></Card>
        </ModulePage>
      );
    }
    let orderError: string | null = null;
    let orderPreparation: Awaited<ReturnType<typeof getOrderInvoicePreparation>> | null = null;
    try {
      orderPreparation = await getOrderInvoicePreparation(sourceId);
    } catch (error) {
      orderError = error instanceof Error ? error.message : "Commande non facturable.";
    }
    if (orderError || !orderPreparation) {
      return (
        <ModulePage>
          <PageHeader title="Nouvelle facture" description="Facturation directe de la commande impossible." />
          <Card className="border-amber-200 bg-amber-50"><CardContent className="text-sm text-amber-800">{orderError ?? "Commande non facturable."}</CardContent></Card>
        </ModulePage>
      );
    }
    const [orderCustomers, orderProducts, orderUnits, orderTaxRates] = await Promise.all([
      listInvoiceCustomers(), listInvoiceProducts(), listInvoiceUnits(), listInvoiceTaxRates(),
    ]);
    return (
      <ModulePage>
        <PageHeader title="Facturer la commande" description={`${orderPreparation.document.document_number} · facture directe, sans bon de livraison. Les quantités ne pourront plus être facturées via un BL.`} />
        <CustomerInvoiceForm
          action={createCustomerInvoice}
          fullAccess={fullAccess}
          customers={orderCustomers}
          products={orderProducts}
          units={orderUnits}
          taxRates={orderTaxRates}
          initialCustomerId={orderPreparation.document.customer_id}
          initialLines={orderPreparation.lines}
          sourceType="order"
          sourceDocumentId={orderPreparation.document.id}
          sourceOrderId={orderPreparation.document.id}
        />
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
  const initialDeliveryNotes = fullAccess && initialCustomer ? await listBillableDeliveryNotesByCustomer(initialCustomer) : [];

  return (
    <ModulePage>
      <PageHeader title="Nouvelle facture de vente" description={fullAccess ? "Choisissez un client, puis saisissez les lignes ou importez ses bons de livraison." : "Choisissez votre client, ajoutez les lignes, puis enregistrez la facture."} />

      <CustomerInvoiceForm
        action={createCustomerInvoice}
        fullAccess={fullAccess}
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
