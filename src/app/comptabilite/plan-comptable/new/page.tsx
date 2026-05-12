import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ChartOfAccountForm } from "@/components/accounting/chart-of-account-form";
import { listChartOfAccounts } from "@/lib/accounting";

export const dynamic = "force-dynamic";

export default async function NewChartOfAccountPage() {
  const result = await listChartOfAccounts({ pageSize: 1000 });
  const parentOptions = result.rows
    .filter((a) => !a.is_auxiliary && a.is_active)
    .map((a) => ({ id: a.id, code: a.code, name: a.name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return (
    <ModulePage>
      <PageHeader title="Nouveau compte" description="Ajoutez un nouveau compte au plan comptable." />
      <Card>
        <CardContent className="pt-6">
          <ChartOfAccountForm parentOptions={parentOptions} />
        </CardContent>
      </Card>
    </ModulePage>
  );
}