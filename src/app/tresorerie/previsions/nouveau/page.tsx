import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { TreasuryForecastForm } from "@/components/treasury/treasury-forecast-form";
import { listActiveTreasuryAccounts } from "@/lib/treasury";
import { createTreasuryForecastItem } from "@/lib/treasury-forecast-actions";

export const dynamic = "force-dynamic";

export default async function NewTreasuryForecastPage() {
  const accounts = await listActiveTreasuryAccounts();
  return (
    <ModulePage>
      <PageHeader
        title="Nouvelle prevision de tresorerie"
        description="Saisissez un flux prevu (entree ou sortie) pour affiner vos previsions."
      />
      <TreasuryForecastForm accounts={accounts} action={createTreasuryForecastItem} />
    </ModulePage>
  );
}
