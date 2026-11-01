import { EmptyState } from "@/components/erp/empty-state";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export default function RapportsPage() {
  return (
    <ModulePage>
      <PageHeader title="Rapports avancés · À venir" description="Cet espace de rapports supplémentaires n’est pas encore disponible." />
      <EmptyState title="Fonctionnalité à venir" description="Utilisez les tableaux de bord de ventes, d’achats et de trésorerie ainsi que les rapports comptables disponibles dans leurs modules. Notre équipe précise avec vous le périmètre de votre projet PRO." />
    </ModulePage>
  );
}
