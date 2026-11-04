import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { refreshLeaveBalancesAction } from "@/lib/hr/actions";
import { leaveBalance, serviceMonthsInYear } from "@/lib/hr/leave-balance";
import { listHrEmployees } from "@/lib/hr/hr";
import { requireHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";
import { LeaveBalanceForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LeaveBalancesPage() {
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const year = new Date().getUTCFullYear();
  const [employees, leaves] = await Promise.all([
    listHrEmployees(),
    supabase.from("hr_leave_requests").select("employee_id, days_count, start_date, status").eq("organization_id", workspace.organization.id).eq("status", "approved"),
  ]);
  const taken = new Map<string, number>();
  for (const row of leaves.data ?? []) {
    if (!String(row.start_date).startsWith(String(year))) continue;
    taken.set(row.employee_id, (taken.get(row.employee_id) ?? 0) + Number(row.days_count ?? 0));
  }
  return (
    <ModulePage>
      <PageHeader title="Soldes de congés" description="1,5 jour ouvrable par mois de service, soit 18 jours par année complète. Le solde se met à jour après acceptation." />
      <LeaveBalanceForm action={refreshLeaveBalancesAction} />
      <Table>
        <thead><tr><Th>Salarié</Th><Th className="text-right">Acquis</Th><Th className="text-right">Pris</Th><Th className="text-right">Restant</Th></tr></thead>
        <tbody>
          {employees.map((employee) => {
            const balance = leaveBalance(serviceMonthsInYear(employee.hire_date, year), taken.get(employee.id) ?? 0);
            return <tr key={employee.id}><Td>{employee.full_name}</Td><Td className="text-right">{balance.acquired.toFixed(2)}</Td><Td className="text-right">{balance.taken.toFixed(2)}</Td><Td className="text-right">{balance.remaining.toFixed(2)}</Td></tr>;
          })}
        </tbody>
      </Table>
    </ModulePage>
  );
}
