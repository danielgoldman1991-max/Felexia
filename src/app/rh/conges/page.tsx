import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrCongesPage() {
  const rows = await listHrTable("hr_leave_requests");
  return <ModulePage><HrSectionPage title="Congés" description="Demandes, validations, soldes, historique et calendrier de congés." rows={rows} columns={[{ key: "start_date", label: "Début" }, { key: "end_date", label: "Fin" }, { key: "days_count", label: "Jours" }, { key: "reason", label: "Motif" }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
