import { DocumentForm } from "@/components/erp/document-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export default function NewPurchaseOrderPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouvelle commande fournisseur" />
      <DocumentForm title="Commande fournisseur" />
    </ModulePage>
  );
}
