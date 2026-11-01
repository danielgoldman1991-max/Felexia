import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrPayslipsPage() {
  const rows = await listHrTable("hr_payslips");
  return <ModulePage><HrSectionPage title="Bulletins préparatoires" description="Préparation du salaire de base selon les paramètres enregistrés. Variables, validation finale et paiement exclus." rows={rows} detailBasePath="/rh/paie/bulletins" notice columns={[{ key: "payslip_number", label: "Bulletin" }, { key: "base_salary", label: "Base", money: true }, { key: "gross_salary", label: "Brut", money: true }, { key: "net_to_pay", label: "Net", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
