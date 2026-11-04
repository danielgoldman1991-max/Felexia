import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrPaiePage() {
  const rows = await listHrTable("hr_payroll_periods");
  return (
    <ModulePage>
      <div className="mb-4 flex gap-2">
        <Link className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]" href="/rh/paie/periodes">Périodes</Link>
        <Link className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]" href="/rh/paie/bulletins">Bulletins</Link>
      </div>
      <HrSectionPage title="Paie" description="Calcul selon le référentiel 2026, validation de la période et paiement avec écriture comptable. Ce n'est pas une déclaration CNSS ni un dépôt fiscal." rows={rows} newHref="/rh/paie/periodes/new" detailBasePath="/rh/paie/periodes" notice columns={[{ key: "period_number", label: "Période" }, { key: "month", label: "Mois" }, { key: "year", label: "Année" }, { key: "total_gross", label: "Brut", money: true }, { key: "total_net", label: "Net", money: true }, { key: "status", label: "Statut", status: true }]} />
    </ModulePage>
  );
}
