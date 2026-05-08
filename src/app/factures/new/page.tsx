import { DocumentForm } from "@/components/erp/document-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export default function NewFacturePage() {
  return (
    <ModulePage>
      <PageHeader title="Nouvelle facture" description="Brouillon avant validation et verrouillage." />
      <DocumentForm title="Facture client" />
    </ModulePage>
  );
}
