import { AlertTriangle, Banknote, Boxes, FileClock, Receipt, TrendingUp, Users } from "lucide-react";
import { DocumentTable, CashTable } from "@/components/erp/data-tables";
import { ModulePage } from "@/components/erp/module-page";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { dashboard, invoices, cashTransactions, thirdParties } from "@/lib/demo-data";
import { requireActiveWorkspace } from "@/lib/auth";

export default async function DashboardPage() {
  const workspace = await requireActiveWorkspace();
  const remaining = dashboard.revenue - dashboard.collected;

  return (
    <ModulePage>
      <PageHeader
        title="Tableau de bord"
        description={`Vue financiere et operationnelle de ${workspace.organization.name}.`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="CA facture" value={<MoneyDisplay value={dashboard.revenue} />} icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="Montant encaisse" value={<MoneyDisplay value={dashboard.collected} />} icon={<Banknote className="h-5 w-5" />} />
        <StatCard title="Reste a encaisser" value={<MoneyDisplay value={remaining} />} icon={<FileClock className="h-5 w-5" />} />
        <StatCard title="Factures en retard" value={dashboard.overdueInvoices} caption="Relance prioritaire" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Dettes fournisseurs" value={<MoneyDisplay value={dashboard.supplierDebt} />} />
        <StatCard title="Solde tresorerie" value={<MoneyDisplay value={dashboard.cashBalance} />} />
        <StatCard title="Marge brute estimee" value={`${dashboard.grossMargin}%`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Alertes stock faible" value={dashboard.lowStock} icon={<Boxes className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Dernieres factures</h2>
          </CardHeader>
          <CardContent>
            <DocumentTable rows={invoices} basePath="/factures" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Top clients debiteurs</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {thirdParties
              .filter((party) => party.balance > 0)
              .map((party) => (
                <div key={party.id} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-soft)] text-sm font-semibold">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{party.name}</p>
                      <p className="text-xs text-[var(--muted)]">{party.city}</p>
                    </div>
                  </div>
                  <MoneyDisplay value={party.balance} />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-semibold">Derniers paiements</h2>
        </CardHeader>
        <CardContent>
          <CashTable rows={cashTransactions} />
        </CardContent>
      </Card>
    </ModulePage>
  );
}
