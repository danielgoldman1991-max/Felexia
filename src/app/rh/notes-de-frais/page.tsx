import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrExpenseReportsPage() {
  const rows = await listHrTable("hr_expense_reports");
  return <ModulePage><HrSectionPage title="Notes de frais" description="Saisie, justificatifs, validation, paiement et lien comptable/trésorerie préparatoire." rows={rows} columns={[{ key: "expense_number", label: "Note" }, { key: "expense_date", label: "Date" }, { key: "category", label: "Catégorie" }, { key: "amount_ttc", label: "TTC", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
