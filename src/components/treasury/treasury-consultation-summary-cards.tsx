import { TrendingUp, TrendingDown, ArrowLeftRight, CheckCircle2, Clock, Banknote } from "lucide-react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatCard } from "@/components/erp/stat-card";
import type { TreasuryConsultationSummary } from "@/lib/treasury-types";

export function TreasuryConsultationSummaryCards({ summary }: { summary: TreasuryConsultationSummary }) {
  return (
    <><p className="mb-3 text-xs text-[var(--muted)]">Totaux de tous les résultats filtrés. Les montants ci-dessous sont en MAD.</p><div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total entrees" value={<MoneyDisplay value={summary.total_in} />} icon={<TrendingUp className="h-5 w-5" />} />
      <StatCard title="Total sorties" value={<MoneyDisplay value={summary.total_out} />} icon={<TrendingDown className="h-5 w-5" />} />
      <StatCard title="Flux net" value={<MoneyDisplay value={summary.net_flow} />} icon={<ArrowLeftRight className="h-5 w-5" />} />
      <StatCard title="Flux comptabilises" value={`${summary.posted_count} / ${summary.total_entries}`} icon={<CheckCircle2 className="h-5 w-5" />} caption={summary.posted_count > 0 ? `${((summary.posted_count / summary.total_entries) * 100).toFixed(0)}% comptabilise` : undefined} />
      <StatCard title="Non comptabilises" value={summary.not_posted_count} icon={<Clock className="h-5 w-5" />} />
      <StatCard title="Rapproches" value={summary.reconciled_count} icon={<CheckCircle2 className="h-5 w-5" />} />
      <StatCard title="Non rapproches" value={summary.unreconciled_count} icon={<Banknote className="h-5 w-5" />} />
    </div>{summary.currencyTotals?.filter((total) => total.currency !== "MAD").map((total) => <p key={total.currency} className="mb-3 text-sm text-[var(--muted)]">{total.currency} : entrées {total.total_in.toFixed(2)} · sorties {total.total_out.toFixed(2)} · net {total.net_flow.toFixed(2)}. Devise conservée séparément.</p>)}</>
  );
}
