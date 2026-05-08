import { CashTable } from "@/components/erp/data-tables";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { cashTransactions, dashboard } from "@/lib/demo-data";

export default function TresoreriePage() {
  return (
    <ModulePage>
      <PageHeader title="Tresorerie" description="Comptes banque/caisse, encaissements et decaissements." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard title="Solde consolide" value={<MoneyDisplay value={dashboard.cashBalance} />} />
        <StatCard title="Encaissements recents" value={<MoneyDisplay value={36000} />} />
        <StatCard title="Decaissements recents" value={<MoneyDisplay value={13380} />} />
      </div>
      <CashTable rows={cashTransactions} />
    </ModulePage>
  );
}
