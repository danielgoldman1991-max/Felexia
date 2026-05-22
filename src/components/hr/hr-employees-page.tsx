import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import type { HrEmployee } from "@/lib/hr/types";

export function HrEmployeesPage({ employees }: { employees: HrEmployee[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Employés"
        description="Fiches salariés, contrats, paie, congés, documents RH et alertes administratives."
        actions={
          <Link href="/rh/employes/new" className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-gradient-to-r from-[#D6B56D] to-[#B8924F] px-4 text-sm font-medium text-[#08090d]">
            <UserPlus className="mr-2 h-4 w-4" />
            Nouvel employé
          </Link>
        }
      />
      <div className="premium-card p-5">
        <Table>
          <thead>
            <tr>
              <Th>Matricule</Th>
              <Th>Employé</Th>
              <Th>Département</Th>
              <Th>Poste</Th>
              <Th>CNSS / RIB</Th>
              <Th>Salaire</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <Td className="font-mono text-xs">{employee.employee_number}</Td>
                <Td>
                  <Link href={`/rh/employes/${employee.id}`} className="font-medium hover:text-[var(--accent-gold)]">{employee.full_name}</Link>
                  <p className="text-xs text-[var(--muted)]">{employee.email ?? employee.phone ?? "Contact à compléter"}</p>
                </Td>
                <Td>{employee.department?.name ?? "À affecter"}</Td>
                <Td>{employee.position?.title ?? "À affecter"}</Td>
                <Td>
                  <p className={employee.cnss_number ? "" : "text-amber-200"}>{employee.cnss_number ? "CNSS OK" : "CNSS manquante"}</p>
                  <p className={employee.rib ? "text-xs text-[var(--muted)]" : "text-xs text-amber-200"}>{employee.rib ? "RIB renseigné" : "RIB manquant"}</p>
                </Td>
                <Td><MoneyDisplay value={employee.base_salary} /></Td>
                <Td><StatusBadge status={employee.employment_status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
