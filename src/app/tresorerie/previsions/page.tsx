import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";

export const dynamic = "force-dynamic";

export default function TreasuryForecastPage() {
  return (
    <ModulePage>
      <PageHeader title="Previsions de tresorerie" description="Vue preparatoire des encaissements et decaissements attendus." />
      <EmptyState
        title="Previsions a consolider"
        description="Cette V1 pose le socle tresorerie. Les previsions combineront les factures ouvertes, echeances fournisseurs et credits disponibles."
      />
    </ModulePage>
  );
}
