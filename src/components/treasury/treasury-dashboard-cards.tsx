import { Banknote, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatCard } from "@/components/erp/stat-card";
import type { TreasuryCounters } from "@/lib/treasury-types";

export function TreasuryDashboardCards({ counters, fullAccess = false }: { counters: TreasuryCounters; fullAccess?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Solde banques" caption="Comptes actifs en MAD" value={<MoneyDisplay value={counters.bankBalance} />} icon={<Landmark className="h-5 w-5" />} />
      <StatCard title="Solde caisses" caption="Caisses actives en MAD" value={<MoneyDisplay value={counters.cashBalance} />} icon={<Banknote className="h-5 w-5" />} />
      <StatCard title="Entrées du mois" caption="Tous les mouvements du mois en MAD" value={<MoneyDisplay value={counters.monthlyIn} />} icon={<TrendingUp className="h-5 w-5" />} />
      <StatCard title="Sorties du mois" caption="Tous les mouvements du mois en MAD" value={<MoneyDisplay value={counters.monthlyOut} />} icon={<TrendingDown className="h-5 w-5" />} />
      {fullAccess ? <><StatCard title="Solde net du mois" caption="Mouvements en MAD" value={<MoneyDisplay value={counters.monthlyNet} />} />
      <StatCard title="Lignes bancaires non rapprochees" value={counters.unreconciledStatementLines} />
      <StatCard title="Mouvements non rapproches" value={counters.unreconciledTransactions} /></> : null}
    </div>
  );
}
