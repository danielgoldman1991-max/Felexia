import { ModulePage } from "@/components/erp/module-page";
import { HrSectionPage } from "@/components/hr/hr-section-page";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrCnssPage() {
  const employees = await listHrEmployees();
  const rows = employees.map((employee) => ({
    id: employee.id,
    employee_number: employee.employee_number,
    full_name: employee.full_name,
    cnss_number: employee.cnss_number ?? "À compléter",
    base_salary: employee.base_salary,
    status: employee.cnss_number ? "ready" : "missing",
  }));
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return <ModulePage><form className="mb-4 flex flex-wrap items-end gap-3 text-sm" action="/rh/cnss/bds"><label>Mois<input name="month" type="number" min="1" max="12" defaultValue={previous.getUTCMonth() + 1} className="ml-2 h-10 w-20 rounded border border-[var(--border)] px-2" /></label><label>Année<input name="year" type="number" defaultValue={previous.getUTCFullYear()} className="ml-2 h-10 w-24 rounded border border-[var(--border)] px-2" /></label><button className="h-10 rounded bg-[var(--primary)] px-3 font-medium text-white" type="submit">Télécharger le BDS</button><span className="text-[var(--muted)]">Bulletins calculés, validés ou payés. Un numéro CNSS différent de 9 chiffres est signalé. Ce n’est pas un dépôt Damancom.</span></form><HrSectionPage title="CNSS / AMO préparatoire" description="Liste déclarable, anomalies CNSS/AMO et export de contrôle préparatoire. Déclaration officielle hors Felexia." rows={rows} notice columns={[{ key: "employee_number", label: "Matricule" }, { key: "full_name", label: "Employé" }, { key: "cnss_number", label: "CNSS" }, { key: "base_salary", label: "Base", money: true }, { key: "status", label: "Statut", status: true }]} /></ModulePage>;
}
