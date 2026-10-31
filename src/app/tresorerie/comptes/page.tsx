import Link from "next/link";
import { Plus } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TreasuryAccountsTable } from "@/components/treasury/treasury-accounts-table";
import { getTreasuryAccountCounters, listTreasuryAccounts } from "@/lib/treasury";
import { requireActiveWorkspace } from "@/lib/auth";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function TreasuryAccountsPage() {
  const workspace = await requireActiveWorkspace();
  const canWrite = !isOperatorRole(workspace.role) && !isReadOnlyRole(workspace.role);
  const [rows, counters] = await Promise.all([listTreasuryAccounts(), getTreasuryAccountCounters()]);
  return (
    <ModulePage>
      <PageHeader
        title="Comptes & caisses"
        description="Gerez les banques, caisses et passerelles qui portent les flux d argent."
        actions={canWrite ? <Button asChild><Link href="/tresorerie/comptes/new"><Plus className="h-4 w-4" /> Nouveau compte</Link></Button> : undefined}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <StatCard title="Comptes" value={counters.total} />
        <StatCard title="Actifs" value={counters.active} />
        <StatCard title="Par defaut" value={counters.defaultAccount?.name ?? "-"} />
      </div>
      <Card><CardContent><TreasuryAccountsTable rows={rows} canManage={canWrite} /></CardContent></Card>
    </ModulePage>
  );
}
