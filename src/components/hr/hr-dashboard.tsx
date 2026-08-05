import Link from "next/link";
import { AlertTriangle, Banknote, BriefcaseBusiness, CalendarDays, FileText, UserPlus, UsersRound, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import type { HrDashboardData } from "@/lib/hr/types";

export function HrDashboard({ data }: { data: HrDashboardData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cockpit RH"
        description="Pilotez les employés, contrats, congés, paie préparatoire, CNSS/AMO et alertes RH dans un espace sombre premium."
        actions={
          <Link href="/rh/employes/new" className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] transition hover:brightness-110">
            <UserPlus className="mr-2 h-4 w-4" />
            Nouvel employé
          </Link>
        }
      />
      <HrPreparatoryNotice />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Employés actifs" value={data.activeEmployees} icon={<UsersRound className="h-4 w-4" />} />
        <StatCard title="Nouveaux recrutements" value={data.newHires} icon={<UserPlus className="h-4 w-4" />} />
        <StatCard title="Contrats en essai" value={data.trialContracts} icon={<BriefcaseBusiness className="h-4 w-4" />} />
        <StatCard title="Congés en attente" value={data.pendingLeaves} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard title="Prêts actifs" value={data.activeLoans} icon={<WalletCards className="h-4 w-4" />} />
        <StatCard title="Absences du mois" value={data.absencesThisMonth} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard title="CDD à surveiller" value={data.contractsEndingSoon} icon={<FileText className="h-4 w-4" />} />
        <StatCard title="Masse brute" value={<MoneyDisplay value={data.grossPayrollThisMonth} />} icon={<Banknote className="h-4 w-4" />} />
        <StatCard title="Net à payer" value={<MoneyDisplay value={data.netPayrollThisMonth} />} icon={<Banknote className="h-4 w-4" />} />
        <StatCard title="Avances ouvertes" value={data.openAdvances} icon={<WalletCards className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="premium-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Derniers employés</h2>
          <Table>
            <thead>
              <tr>
                <Th>Matricule</Th>
                <Th>Employé</Th>
                <Th>Poste</Th>
                <Th>Statut</Th>
                <Th>Salaire</Th>
              </tr>
            </thead>
            <tbody>
              {data.recentEmployees.map((employee) => (
                <tr key={employee.id}>
                  <Td className="font-mono text-xs">{employee.employee_number}</Td>
                  <Td>
                    <Link href={`/rh/employes/${employee.id}`} className="font-medium hover:text-[var(--accent-gold)]">{employee.full_name}</Link>
                    <p className="text-xs text-[var(--muted)]">{employee.email ?? employee.phone ?? "Contact à compléter"}</p>
                  </Td>
                  <Td>{employee.position?.title ?? "À affecter"}</Td>
                  <Td><StatusBadge status={employee.employment_status} /></Td>
                  <Td><MoneyDisplay value={employee.base_salary} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="space-y-4">
          <div className="premium-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Ce qui mérite attention</h2>
            <div className="space-y-3">
              {data.alerts.map((alert) => (
                <div key={alert.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3">
                  <p className="font-medium">{alert.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{alert.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="premium-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Répartition départements</h2>
            <div className="space-y-2">
              {data.departments.slice(0, 8).map((department) => (
                <div key={department.name} className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm">
                  <span>{department.name}</span>
                  <span className="font-semibold text-[var(--accent-gold)]">{department.employees}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
