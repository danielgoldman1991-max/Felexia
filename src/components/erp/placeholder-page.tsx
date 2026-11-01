import { EmptyState } from "@/components/erp/empty-state";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <ModulePage>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Fonctionnalité à venir"
        description="Cet écran n’est pas encore disponible pour vos opérations. Pour votre projet PRO, notre équipe confirme avec vous les fonctions utilisables et les étapes de mise en place."
      />
    </ModulePage>
  );
}
