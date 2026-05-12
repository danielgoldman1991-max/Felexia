import Link from "next/link";
import { Plus } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TreasuryDashboardCards } from "@/components/treasury/treasury-dashboard-cards";
import { TreasuryTransactionsTable } from "@/components/treasury/treasury-transactions-table";
import { TreasuryAccountsTable } from "@/components/treasury/treasury-accounts-table";
import { getTreasuryDashboard } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function TreasuryDashboardPage() {
  const dashboard = await getTreasuryDashboard();
  return (
    <ModulePage>
      <PageHeader
        title="Tresorerie"
        description="Suivez les comptes bancaires, caisses, encaissements, decaissements et rapprochements."
        actions={<Link href="/tresorerie/mouvements/new"><Button><Plus className="h-4 w-4" /> Nouveau mouvement</Button></Link>}
      />
      <div className="space-y-6">
        <TreasuryDashboardCards counters={dashboard} />
        <Card>
          <CardHeader><h2 className="font-semibold">Comptes avec soldes</h2></CardHeader>
          <CardContent><TreasuryAccountsTable rows={dashboard.accounts} /></CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Derniers mouvements</h2></CardHeader>
          <CardContent><TreasuryTransactionsTable rows={dashboard.recentTransactions} /></CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}
