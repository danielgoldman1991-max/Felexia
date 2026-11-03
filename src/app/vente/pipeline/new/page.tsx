import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createOpportunity } from "@/lib/sales/crm-actions";
import { OpportunityForm } from "./form";

export default function NewOpportunityPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouvelle opportunité" description="Le montant est pondéré selon l'étape." />
      <OpportunityForm action={createOpportunity} />
    </ModulePage>
  );
}
