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
      <HrSectionPage title="Paie préparatoire" description="Créez, calculez et validez des périodes de paie avec paramètres CNSS/AMO/IR configurables." rows={rows} newHref="/rh/paie/periodes/new" notice columns={[{ key: "period_number", label: "Période" }, { key: "month", label: "Mois" }, { key: "year", label: "Année" }, { key: "total_gross", label: "Brut", money: true }, { key: "total_net", label: "Net", money: true }, { key: "status", label: "Statut", status: true }]} />
    </ModulePage>
  );
}
