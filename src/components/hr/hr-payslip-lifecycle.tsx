import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { payslipAmountsLocked, payslipStatusLabel } from "@/lib/hr/payslip-lifecycle";
import { validatePayslipAction, markPayslipPaidAction } from "@/lib/hr/payslip-lifecycle-actions";
import { PayslipStatusButton } from "@/components/hr/payslip-status-button";
import { formatMoney } from "@/lib/format";
import { isMissingSchema } from "@/lib/optional-schema";

export async function HrPayslipLifecycle({ periodId, readOnly }: { periodId: string; readOnly: boolean }) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_payslips")
    .select("id, payslip_number, status, net_to_pay, employee:employee_id(first_name, last_name)")
    .eq("organization_id", workspace.organization.id)
    .eq("payroll_period_id", periodId);
  if (isMissingSchema(error)) return null;
  const slips = data ?? [];
  if (slips.length === 0) return <p className="text-sm text-[var(--muted)]">Aucun bulletin enregistré pour cette période.</p>;
  return (
    <div className="premium-card mt-5 space-y-3 p-5">
      <h2 className="font-semibold">Cycle du bulletin</h2>
      <p className="text-sm text-[var(--muted)]">Brouillon, puis validé, puis payé. Dès la validation, les montants sont figés.</p>
      <ul className="space-y-3">
        {slips.map((slip) => {
          const employee = Array.isArray(slip.employee) ? slip.employee[0] : slip.employee;
          const name = employee ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() : "Salarié";
          const status = String(slip.status);
          return (
            <li key={slip.id as string} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2">
              <div>
                <p className="font-medium">{name || "Salarié"} · {slip.payslip_number as string}</p>
                <p className="text-sm text-[var(--muted)]">{payslipStatusLabel(status)} · Net à payer {formatMoney(Number(slip.net_to_pay ?? 0))}</p>
              </div>
              {readOnly || status === "paid" ? (
                payslipAmountsLocked(status) ? <span className="text-sm">Montants figés</span> : null
              ) : (
                <PayslipStatusButton
                  action={status === "validated" ? markPayslipPaidAction : validatePayslipAction}
                  id={slip.id as string}
                  label={status === "validated" ? "Marquer payé" : "Valider le bulletin"}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
