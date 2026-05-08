import { EmptyState } from "@/components/erp/empty-state";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export default function RapportsPage() {
  return (
    <ModulePage>
      <PageHeader title="Rapports" description="Reporting ventes, marge, stock et tresorerie." />
      <EmptyState title="Rapports avances a connecter" description="Les vues SQL de dashboard sont prevues dans la migration pour alimenter les prochains rapports." />
    </ModulePage>
  );
}
