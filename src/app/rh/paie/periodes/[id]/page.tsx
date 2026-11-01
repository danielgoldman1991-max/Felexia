import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { HrManagementAction } from "@/components/hr/hr-management-action";
import { getHrPayrollPeriod } from "@/lib/hr/payroll";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { HrPayrollPreparationForm } from "@/components/hr/hr-payroll-preparation-form";

export default async function PayrollPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const period = await getHrPayrollPeriod(id);
  if (!period) notFound();
  return (
    <ModulePage>
      <PageHeader title={period.period_number} description="Préparation du salaire de base uniquement. Validation finale et paiement indisponibles." />
      <HrPreparatoryNotice />
      <div className="premium-card mt-5 space-y-4 p-5">
        <p className="text-sm text-[var(--foreground)]">Les primes, heures supplémentaires, absences, avances, prêts et autres variables ne sont pas intégrés. Ce résultat ne peut pas servir de paie finale. Les taux sociaux, le plafond CNSS et le barème IR nécessaires doivent être configurés et vérifiés avant tout calcul.</p>
        <p className="text-sm text-[var(--muted)]">{period.employees_count ?? 0} salariés · Brut préparatoire {formatMoney(period.total_gross)} · Net préparatoire {formatMoney(period.total_net)}</p>
        {["draft", "calculated"].includes(period.status) ? <HrManagementAction><HrPayrollPreparationForm periodId={id} updatedAt={period.updated_at} /></HrManagementAction> : <p className="text-sm">Cette période est conservée en consultation et ne peut pas être recalculée.</p>}
      </div>
    </ModulePage>
  );
}
