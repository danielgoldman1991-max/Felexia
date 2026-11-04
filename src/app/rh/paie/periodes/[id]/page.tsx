import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { HrManagementAction } from "@/components/hr/hr-management-action";
import { getHrPayrollPeriod } from "@/lib/hr/payroll";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { HrPayrollPreparationForm } from "@/components/hr/hr-payroll-preparation-form";
import { HrFullPayslipForm } from "@/components/hr/hr-full-payslip-form";
import { HrPayslipLifecycle } from "@/components/hr/hr-payslip-lifecycle";
import { listHrEmployees } from "@/lib/hr/hr";

export default async function PayrollPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const period = await getHrPayrollPeriod(id);
  if (!period) notFound();
  const employees = (await listHrEmployees()).map((employee) => ({ id: employee.id, full_name: employee.full_name }));
  return (
    <ModulePage>
      <PageHeader title={period.period_number} description="Référentiel 2026 : brut, ancienneté, CNSS, AMO, IR et charges de famille. Vous pouvez valider la période puis la payer." />
      <HrPreparatoryNotice />
      <div className="premium-card mt-5 space-y-4 p-5">
        <p className="text-sm text-[var(--foreground)]">Les primes et les heures supplémentaires se saisissent sur le bulletin complet. Les avances du mois et les échéances de prêt actives sont reprises automatiquement.</p>
        <p className="text-sm text-[var(--muted)]">{period.employees_count ?? 0} salariés · Brut préparatoire {formatMoney(period.total_gross)} · Net préparatoire {formatMoney(period.total_net)}</p>
        {["draft", "calculated", "validated"].includes(period.status) ? <HrManagementAction><HrPayrollPreparationForm periodId={id} updatedAt={period.updated_at} status={period.status} /></HrManagementAction> : <p className="text-sm">Cette période est payée. Les bulletins restent consultables.</p>}
      </div>
      <div className="premium-card mt-5 space-y-4 p-5">
        <h2 className="font-semibold">Bulletin complet 2026</h2>
        <p className="text-sm text-[var(--muted)]">Primes, ancienneté, heures supplémentaires, indemnités et avances. Le net à payer en déduit l’avance. Ce bulletin est enregistré, pas encore une paie validée.</p>
        {["draft", "calculated"].includes(period.status) ? <HrManagementAction><HrFullPayslipForm periodId={id} employees={employees} /></HrManagementAction> : <p className="text-sm">Les éléments du bulletin sont figés après validation.</p>}
      </div>
      <HrPayslipLifecycle periodId={id} readOnly={period.status === "paid"} />
    </ModulePage>
  );
}
