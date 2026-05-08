import { EmptyState } from "@/components/erp/empty-state";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <ModulePage>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Module pret a etendre"
        description="La route existe deja avec le layout ERP. Les tables, statuts et relations sont prevus dans la migration initiale."
      />
    </ModulePage>
  );
}
