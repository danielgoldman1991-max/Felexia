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

export default async function PayrollPeriodDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ prepare?: string; count?: string; skipped?: string }> }) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const period = await getHrPayrollPeriod(id);
  if (!period) notFound();
  const employees = (await listHrEmployees()).map((employee) => ({ id: employee.id, full_name: employee.full_name }));
  return (
    <ModulePage>
      <PageHeader title={period.period_number} description="Référentiel 2026 : brut, ancienneté, CNSS, AMO, IR et charges de famille. Vous pouvez valider la période puis la payer." />
      <HrPreparatoryNotice />
      {query.prepare === "1" ? <p role="status" className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{query.count ?? "0"} bulletin{(query.count ?? "0") === "1" ? "" : "s"} enregistré{(query.count ?? "0") === "1" ? "" : "s"}.{query.skipped ? ` Ignorés : ${query.skipped}` : ""}</p> : null}
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
