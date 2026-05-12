import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { JournalsTable } from "@/components/accounting/journals-table";
import { listAccountingJournalsWithStats } from "@/lib/accounting";

export default async function JournalsPage() {
  const journals = await listAccountingJournalsWithStats();

  return (
    <ModulePage>
      <PageHeader
        title="Journaux"
        description="Journaux comptables de vente, achat, banque et operations diverses."
      />
      <JournalsTable rows={journals} />
    </ModulePage>
  );
}
