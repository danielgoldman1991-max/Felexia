import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrPayslipsPage() {
  const rows = await listHrTable("hr_payslips");
  return <ModulePage><HrSectionPage title="Bulletins de paie" description="Bulletins préparatoires avec brut, retenues, net à payer et détails CNSS/AMO/IR paramétrables." rows={rows} notice columns={[{ key: "payslip_number", label: "Bulletin" }, { key: "base_salary", label: "Base", money: true }, { key: "gross_salary", label: "Brut", money: true }, { key: "net_to_pay", label: "Net", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
