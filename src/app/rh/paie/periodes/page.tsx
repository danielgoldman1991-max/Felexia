import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrPayrollPeriodsPage() {
  const rows = await listHrTable("hr_payroll_periods");
  return (
    <ModulePage>
      <HrSectionPage
        title="Périodes de paie"
        description="Préparation du salaire de base uniquement. Variables, validation finale et paiement non disponibles."
        rows={rows}
        newHref="/rh/paie/periodes/new"
        detailBasePath="/rh/paie/periodes"
        notice
        columns={[
          { key: "period_number", label: "Période" },
          { key: "month", label: "Mois" },
          { key: "year", label: "Année" },
          { key: "employees_count", label: "Employés" },
          { key: "total_net", label: "Net", money: true },
          { key: "status", label: "Statut", status: true },
        ]}
      />
    </ModulePage>
  );
}
