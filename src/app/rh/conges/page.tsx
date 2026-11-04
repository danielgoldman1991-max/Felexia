import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrCongesPage() {
  const rows = (await listHrTable("hr_leave_requests")).map((row) => ({
    ...row,
    periode: `${row.start_date ?? ""} → ${row.end_date ?? ""}`,
  }));
  return <ModulePage><HrSectionPage title="Congés" description="Demande, acceptation ou refus, décompte du solde et historique." rows={rows} newHref="/rh/conges/new" detailBasePath="/rh/conges" columns={[{ key: "periode", label: "Période" }, { key: "days_count", label: "Jours" }, { key: "reason", label: "Motif" }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
