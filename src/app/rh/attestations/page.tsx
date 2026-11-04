import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { requireHrWorkspace } from "@/lib/hr/access";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrAttestationsPage() {
  await requireHrWorkspace();
  const employees = await listHrEmployees();
  return (
    <ModulePage>
      <PageHeader title="Attestations" description="Impression depuis le dossier salarié. Ces documents ne sont ni signés électroniquement ni transmis à un organisme." />
      {employees.length === 0 ? <p className="text-sm text-[var(--muted)]">Ajoutez un salarié pour préparer une attestation.</p> : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
          {employees.map((employee) => (
            <div key={employee.id} className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium">{employee.full_name}<span className="ml-2 text-sm text-[var(--muted)]">{employee.employee_number}</span></p>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link className="font-medium text-[var(--primary)] hover:underline" href={`/rh/attestations/${employee.id}/travail`}>Attestation de travail</Link>
                <Link className="font-medium text-[var(--primary)] hover:underline" href={`/rh/attestations/${employee.id}/salaire`}>Attestation de salaire</Link>
                <Link className="font-medium text-[var(--primary)] hover:underline" href={`/rh/attestations/${employee.id}/certificat`}>Certificat de travail</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModulePage>
  );
}
