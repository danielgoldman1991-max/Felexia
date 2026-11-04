import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrAbsencesPage() {
  const rows = (await listHrTable("hr_absences")).map((row) => ({ ...row, justified: row.justified ? "Oui" : "Non" }));
  return <ModulePage><HrSectionPage title="Absences" description="Saisie, validation ou annulation. L'impact sur la paie reste à reporter sur le bulletin." rows={rows} newHref="/rh/absences/new" detailBasePath="/rh/absences" columns={[{ key: "absence_date", label: "Date" }, { key: "absence_type", label: "Type" }, { key: "justified", label: "Justifiée" }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
