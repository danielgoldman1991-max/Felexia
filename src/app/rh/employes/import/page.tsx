import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmployeeImportForm } from "@/components/hr/employee-import-form";
import { requireHrWorkspace } from "@/lib/hr/access";
import { canWriteHrSettings } from "@/lib/hr/settings-access";

export const dynamic = "force-dynamic";

export default async function EmployeeImportPage() {
  const workspace = await requireHrWorkspace();
  const canWrite = await canWriteHrSettings(workspace);
  return (
    <ModulePage>
      <PageHeader title="Importer des salariés" description="Prévisualisez le fichier, corrigez chaque ligne, puis importez tout le fichier d'un seul coup." actions={<Link className="text-sm font-semibold text-[var(--primary)]" href="/rh/employes">Retour aux employés</Link>} />
      {canWrite ? <EmployeeImportForm /> : <p className="text-sm text-[var(--muted)]">Votre rôle ne permet pas d&apos;importer des salariés.</p>}
    </ModulePage>
  );
}
