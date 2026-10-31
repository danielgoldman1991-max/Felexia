import Link from "next/link";
import { Plus } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TreasuryTransactionsTable } from "@/components/treasury/treasury-transactions-table";
import { listTreasuryTransactions } from "@/lib/treasury";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export const dynamic = "force-dynamic";

export default async function TreasuryTransactionsPage({ searchParams }: { searchParams: Promise<{ accountId?: string; direction?: string; type?: string; status?: string }> }) {
  const filters = await searchParams;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const rows = await listTreasuryTransactions(filters);
  return (
    <ModulePage>
      <PageHeader
        title="Mouvements de tresorerie"
        description="Journal operationnel des entrees et sorties d argent."
        actions={<Button asChild><Link href="/tresorerie/mouvements/new"><Plus className="h-4 w-4" /> Nouveau mouvement</Link></Button>}
      />
      <Card><CardContent><TreasuryTransactionsTable rows={rows} fullAccess={fullAccess} /></CardContent></Card>
    </ModulePage>
  );
}
