import { AlertTriangle, CheckCircle2, FileText, Landmark, ReceiptText, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/format";
import type { DgiVatSummary } from "@/lib/tax/dgi-vat-types";

function SummaryCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof FileText;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.03em] text-[var(--muted)]">{title}</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--secondary)]">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function DgiExportSummaryCards({ summary }: { summary: DgiVatSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="CA taxable HT" value={formatMoney(summary.taxableTurnoverMad)} helper="Base imposable préparatoire de la période." icon={Landmark} />
      <SummaryCard title="TVA collectée" value={formatMoney(summary.collectedVatMad)} helper={`${formatNumber(summary.salesCount)} pièce(s) client incluses.`} icon={ReceiptText} />
      <SummaryCard title="TVA déductible" value={formatMoney(summary.deductibleVatMad)} helper={`${formatNumber(summary.purchaseCount)} pièce(s) fournisseur incluses.`} icon={ShieldCheck} />
      <SummaryCard title="Solde TVA" value={formatMoney(summary.vatDueMad)} helper={`Crédit à reporter : ${formatMoney(summary.creditCarryForwardMad)}.`} icon={CheckCircle2} />
      <SummaryCard title="Crédit antérieur" value={formatMoney(summary.priorCreditMad)} helper="Valeur déclarative de contrôle, saisie au lancement." icon={FileText} />
      <SummaryCard title="CA total HT" value={formatMoney(summary.totalTurnoverMad)} helper="Inclut les avoirs client en négatif." icon={Landmark} />
      <SummaryCard title="Bloquants" value={formatNumber(summary.blockingErrorsCount)} helper="Doivent être corrigés avant génération XML." icon={AlertTriangle} />
      <SummaryCard title="Warnings" value={formatNumber(summary.warningsCount)} helper="À contrôler avant dépôt officiel." icon={AlertTriangle} />
    </div>
  );
}
