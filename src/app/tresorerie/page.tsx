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
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export const dynamic = "force-dynamic";

export default async function TreasuryDashboardPage() {
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const dashboard = await getTreasuryDashboard();
  return (
    <ModulePage>
      <PageHeader
        title="Trésorerie"
        description="Retrouvez vos soldes bancaires, votre caisse et vos entrées et sorties d’argent."
        actions={<><Button variant="secondary" asChild><Link href="/tresorerie/comptes/new"><Plus className="h-4 w-4" /> Ajouter un compte</Link></Button><Button asChild><Link href="/tresorerie/mouvements/new"><Plus className="h-4 w-4" /> Nouveau mouvement</Link></Button></>}
      />
      <div className="space-y-6">
        <TreasuryDashboardCards counters={dashboard} fullAccess={fullAccess} />
        <p className="text-sm text-[var(--muted)]">Pour régler une facture, utilisez <Link href="/facturation/paiements/new" className="font-medium text-[var(--primary)] underline">un règlement client</Link> ou <Link href="/achats/paiements/new" className="font-medium text-[var(--primary)] underline">un règlement fournisseur</Link>. Le mouvement de trésorerie sera créé automatiquement.</p>
        <Card>
          <CardHeader><h2 className="font-semibold">Comptes avec soldes</h2></CardHeader>
          <CardContent><TreasuryAccountsTable rows={dashboard.accounts} /></CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Derniers mouvements</h2></CardHeader>
          <CardContent><TreasuryTransactionsTable rows={dashboard.recentTransactions} fullAccess={fullAccess} /></CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}
