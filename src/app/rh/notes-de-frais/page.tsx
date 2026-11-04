import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrExpenseReportsPage() {
  const rows = await listHrTable("hr_expense_reports");
  return <ModulePage><HrSectionPage title="Notes de frais" description="Soumission, approbation ou refus, puis marquage du remboursement. Aucune écriture comptable n'est générée." rows={rows} newHref="/rh/notes-de-frais/new" detailBasePath="/rh/notes-de-frais" columns={[{ key: "expense_number", label: "Note" }, { key: "expense_date", label: "Date" }, { key: "category", label: "Catégorie" }, { key: "amount_ttc", label: "TTC", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
