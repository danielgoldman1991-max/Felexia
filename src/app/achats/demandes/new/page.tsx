import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createPurchaseRequest } from "@/lib/purchases/procurement-actions";
import { PurchaseRequestForm } from "./form";

export default function NewPurchaseRequestPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouvelle demande d'achat" description="Décrivez le besoin. La commande fournisseur reste une étape séparée." />
      <PurchaseRequestForm action={createPurchaseRequest} />
    </ModulePage>
  );
}
