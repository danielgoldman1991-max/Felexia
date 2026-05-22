import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrIrPage() {
  const rows = await listHrTable("hr_payslips");
  return <ModulePage><HrSectionPage title="IR salaire préparatoire" description="Synthèse base imposable, IR estimé et anomalies selon barème configurable dans Paramètres RH." rows={rows} notice columns={[{ key: "payslip_number", label: "Bulletin" }, { key: "taxable_gross", label: "Base imposable", money: true }, { key: "ir_amount", label: "IR estimé", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
