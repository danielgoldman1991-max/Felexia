import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { Button } from "@/components/ui/button";
import { EmployeeOptions, HrEntryForm, HrField, HrInput, HrSelect } from "@/components/hr/hr-entry-form";
import { createHrDocumentAction } from "@/lib/hr/consult-actions";
import { listHrEmployees, listHrTable } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrDocumentsPage() {
  const [rows, employees] = await Promise.all([listHrTable("hr_documents"), listHrEmployees()]);
  return <ModulePage>
    <HrEntryForm action={createHrDocumentAction}>
      <HrField label="Salarié" wide><HrSelect name="employee_id" required><EmployeeOptions employees={employees} /></HrSelect></HrField>
      <HrField label="Type"><HrInput name="document_type" required placeholder="CIN, contrat, certificat" /></HrField>
      <HrField label="Titre"><HrInput name="title" required /></HrField>
      <HrField label="Lien ou chemin du fichier" wide><HrInput name="file_path" placeholder="Chemin du fichier déjà déposé dans les documents RH" /></HrField>
      <HrField label="Expiration"><HrInput name="expires_at" type="date" /></HrField>
      <div className="md:col-span-2 flex justify-end"><Button type="submit">Rattacher le document</Button></div>
    </HrEntryForm>
    <HrSectionPage title="Documents RH" description="Dossier salarié, CIN, RIB, contrats et certificats rattachés au salarié." rows={rows} newHref="/rh/documents#creer" columns={[{ key: "document_type", label: "Type" }, { key: "title", label: "Titre" }, { key: "expires_at", label: "Expiration" }, { key: "status", label: "Statut", status: true }]} />
  </ModulePage>;
}
