import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrIrPage() {
  const rows = await listHrTable("hr_payslips");
  return <ModulePage><p className="mb-4 text-sm"><a className="font-semibold text-[var(--primary)]" href={`/rh/ir/etat-9421?year=${new Date().getFullYear()}`}>Télécharger l’état 9421 préparatoire</a>. Ce n’est pas le dépôt EDI.</p><HrSectionPage title="IR salaire préparatoire" description="Synthèse base imposable, IR estimé et anomalies selon barème configurable dans Paramètres RH." rows={rows} notice columns={[{ key: "payslip_number", label: "Bulletin" }, { key: "taxable_gross", label: "Base imposable", money: true }, { key: "ir_amount", label: "IR estimé", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
