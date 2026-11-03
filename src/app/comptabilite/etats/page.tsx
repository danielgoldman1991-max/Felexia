import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { getAccountingReportLines } from "@/lib/accounting";
import { buildFinancialStatements } from "@/lib/accounting/financial-statements";

export const dynamic = "force-dynamic";

export default async function FinancialStatementsPage() {
  const lines = await getAccountingReportLines({});
  const statements = buildFinancialStatements(lines.map((line) => ({
    accountCode: line.account_code,
    debit: line.debit,
    credit: line.credit,
  })));
  const rows = [
    ["Actif (classes 2, 3 et soldes débiteurs 4/5)", statements.actif],
    ["Passif, capitaux et résultat", statements.passif],
    ["Charges (classe 6)", statements.charges],
    ["Produits (classe 7)", statements.produits],
    ["Résultat (produits − charges)", statements.resultat],
  ] as const;
  return (
    <ModulePage>
      <PageHeader title="Bilan et CPC préparatoires" description="Synthèse CGNC des écritures comptabilisées. Ce n'est pas un bilan certifié ni une liasse fiscale." />
      <p className="text-sm text-[var(--muted)]">Les classes 1 à 5 sont ventilées par solde. Le résultat de la période est reporté au passif pour vérifier l’équilibre. <Link className="font-semibold text-[var(--primary)]" href="/comptabilite/balance">Voir la balance</Link></p>
      <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
            <span>{label}</span>
            <span className="font-semibold tabular-nums"><MoneyDisplay value={value} /></span>
          </div>
        ))}
      </div>
      <p className={`mt-3 text-sm font-medium ${statements.balanced ? "text-emerald-700" : "text-red-700"}`}>
        {statements.balanced ? "Actif et passif sont équilibrés à 0,01 MAD près." : "L'actif et le passif ne s'équilibrent pas. Vérifiez les écritures et les comptes hors classes 1 à 7."}
      </p>
    </ModulePage>
  );
}
