import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrAvancesPage() {
  const rows = await listHrTable("hr_advances");
  return <ModulePage><HrSectionPage title="Avances sur salaire" description="Demande, approbation et marquage du paiement. La retenue se saisit sur le bulletin." rows={rows} newHref="/rh/avances/new" detailBasePath="/rh/avances" columns={[{ key: "advance_number", label: "Avance" }, { key: "request_date", label: "Date" }, { key: "amount", label: "Montant", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
