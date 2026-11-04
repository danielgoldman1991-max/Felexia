import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { HrManagementAction } from "@/components/hr/hr-management-action";
import { getHrPayrollPeriod } from "@/lib/hr/payroll";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { HrPayrollPreparationForm } from "@/components/hr/hr-payroll-preparation-form";
import { HrFullPayslipForm } from "@/components/hr/hr-full-payslip-form";
import { listHrEmployees } from "@/lib/hr/hr";

export default async function PayrollPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const period = await getHrPayrollPeriod(id);
  if (!period) notFound();
  const employees = (await listHrEmployees()).map((employee) => ({ id: employee.id, full_name: employee.full_name }));
  return (
    <ModulePage>
      <PageHeader title={period.period_number} description="Préparation du salaire de base uniquement. Validation finale et paiement indisponibles." />
      <HrPreparatoryNotice />
      <div className="premium-card mt-5 space-y-4 p-5">
        <p className="text-sm text-[var(--foreground)]">Les primes, heures supplémentaires, absences, avances, prêts et autres variables ne sont pas intégrés dans cette préparation, sans variables de paie finale. Ce résultat ne peut pas servir de paie finale.</p>
        <p className="text-sm text-[var(--muted)]">{period.employees_count ?? 0} salariés · Brut préparatoire {formatMoney(period.total_gross)} · Net préparatoire {formatMoney(period.total_net)}</p>
        {["draft", "calculated"].includes(period.status) ? <HrManagementAction><HrPayrollPreparationForm periodId={id} updatedAt={period.updated_at} /></HrManagementAction> : <p className="text-sm">Cette période est conservée en consultation et ne peut pas être recalculée.</p>}
      </div>
      <div className="premium-card mt-5 space-y-4 p-5">
        <h2 className="font-semibold">Bulletin complet 2026</h2>
        <p className="text-sm text-[var(--muted)]">Primes, ancienneté, heures supplémentaires, indemnités et avances. Le net à payer en déduit l’avance. Ce bulletin est enregistré, pas encore une paie validée.</p>
        {["draft", "calculated"].includes(period.status) ? <HrManagementAction><HrFullPayslipForm periodId={id} employees={employees} /></HrManagementAction> : null}
      </div>
    </ModulePage>
  );
}
