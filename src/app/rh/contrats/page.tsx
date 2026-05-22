import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrContratsPage() {
  const rows = await listHrTable("hr_contracts");
  return (
    <ModulePage>
      <HrSectionPage
        title="Contrats"
        description="Contrats CDI, CDD, ANAPEC, stage et alertes de période d'essai ou d'expiration."
        rows={rows}
        newHref="/rh/contrats/new"
        columns={[
          { key: "contract_number", label: "Contrat" },
          { key: "contract_type", label: "Type" },
          { key: "start_date", label: "Début" },
          { key: "end_date", label: "Fin" },
          { key: "base_salary", label: "Salaire", money: true },
          { key: "status", label: "Statut", status: true },
        ]}
      />
    </ModulePage>
  );
}
