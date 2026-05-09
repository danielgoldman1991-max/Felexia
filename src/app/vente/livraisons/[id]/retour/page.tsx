import { notFound } from "next/navigation";
import { ReturnNoteForm } from "@/components/sales/return-note-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createReturnFromDelivery } from "@/lib/sales-actions";
import { getReturnPreparation } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function ReturnFromDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, lines } = await getReturnPreparation(id);

  if (!document || !["validated", "delivered"].includes(document.status)) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader
        title="Creer un retour client"
        description={`Bon de livraison ${document.document_number}`}
      />
      <ReturnNoteForm delivery={document} lines={lines} action={createReturnFromDelivery} />
    </ModulePage>
  );
}
