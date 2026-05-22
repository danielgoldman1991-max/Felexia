import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrDocumentsPage() {
  const rows = await listHrTable("hr_documents");
  return <ModulePage><HrSectionPage title="Documents RH" description="Dossier salarié, CIN, RIB, contrats, certificats, expirations et stockage privé sécurisé." rows={rows} columns={[{ key: "document_type", label: "Type" }, { key: "title", label: "Titre" }, { key: "expires_at", label: "Expiration" }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
