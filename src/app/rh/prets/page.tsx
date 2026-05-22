import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrPretsPage() {
  const rows = await listHrTable("hr_loans");
  return <ModulePage><HrSectionPage title="Prêts salariés" description="Prêts internes, mensualités, solde restant, suspension et clôture." rows={rows} columns={[{ key: "loan_number", label: "Prêt" }, { key: "amount", label: "Montant", money: true }, { key: "monthly_deduction", label: "Mensualité", money: true }, { key: "remaining_amount", label: "Restant", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
