import { Banknote, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatCard } from "@/components/erp/stat-card";
import type { TreasuryCounters } from "@/lib/treasury-types";

export function TreasuryDashboardCards({ counters }: { counters: TreasuryCounters }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Solde banques" value={<MoneyDisplay value={counters.bankBalance} />} icon={<Landmark className="h-5 w-5" />} />
      <StatCard title="Solde caisses" value={<MoneyDisplay value={counters.cashBalance} />} icon={<Banknote className="h-5 w-5" />} />
      <StatCard title="Entrees du mois" value={<MoneyDisplay value={counters.monthlyIn} />} icon={<TrendingUp className="h-5 w-5" />} />
      <StatCard title="Sorties du mois" value={<MoneyDisplay value={counters.monthlyOut} />} icon={<TrendingDown className="h-5 w-5" />} />
      <StatCard title="Solde net du mois" value={<MoneyDisplay value={counters.monthlyNet} />} />
      <StatCard title="Lignes bancaires non rapprochees" value={counters.unreconciledStatementLines} />
      <StatCard title="Mouvements non rapproches" value={counters.unreconciledTransactions} />
    </div>
  );
}
