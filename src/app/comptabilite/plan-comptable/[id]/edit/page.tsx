import { redirect } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ChartOfAccountForm } from "@/components/accounting/chart-of-account-form";
import { listChartOfAccounts } from "@/lib/accounting";
import { getAccountingAccount } from "@/lib/accounting-actions";
import type { AccountingAccountRecord } from "@/lib/accounting-types";

export const dynamic = "force-dynamic";

export default async function EditChartOfAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, parentResult] = await Promise.all([
    getAccountingAccount(id),
    listChartOfAccounts({ pageSize: 1000 }),
  ]);

  if (!result.success || !result.data) {
    redirect("/comptabilite/plan-comptable");
  }

  const account = result.data as AccountingAccountRecord;
  const parentOptions = parentResult.rows
    .filter((a) => a.id !== account.id && !a.is_auxiliary && a.is_active)
    .map((a) => ({ id: a.id, code: a.code, name: a.name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return (
    <ModulePage>
      <PageHeader title={`Modifier ${account.code} - ${account.name}`} description="Modifiez les informations du compte comptable." />
      <Card>
        <CardContent className="pt-6">
          <ChartOfAccountForm account={account} parentOptions={parentOptions} />
        </CardContent>
      </Card>
    </ModulePage>
  );
}