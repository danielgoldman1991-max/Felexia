import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { requireHrWorkspace } from "@/lib/hr/access";
import { payslipStatusLabel } from "@/lib/hr/payslip-lifecycle";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Line = { label?: string; amount?: number; code?: string };

export default async function HrPayslipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const { data: slip } = await supabase.from("hr_payslips").select("*").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (!slip) notFound();
  const { data: employee } = await supabase.from("hr_employees").select("full_name, employee_number").eq("id", slip.employee_id).maybeSingle();
  const details = slip.calculation_details as { dependents?: number; slip?: { professionalExpense?: number; taxableMonthly?: number; familyReduction?: number; seniorityBonus?: number } } | null;
  const earnings = Array.isArray(slip.earnings) ? slip.earnings as Line[] : [];
  const deductions = Array.isArray(slip.deductions) ? slip.deductions as Line[] : [];
  const employer = Array.isArray(slip.employer_contributions) ? slip.employer_contributions as Line[] : [];
  return (
    <ModulePage>
      <PageHeader
        title={slip.payslip_number ?? "Bulletin"}
        description={`${employee?.full_name ?? "Salarié"} · ${payslipStatusLabel(String(slip.status))} · ${details?.dependents ?? 0} personne(s) à charge retenue(s) pour l'IR`}
        actions={<Link className="text-sm font-medium text-[var(--primary)]" href={`/rh/paie/bulletins/${id}/print`}>Imprimer / PDF</Link>}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Card label="Brut" value={Number(slip.gross_salary ?? 0)} />
        <Card label="Net imposable" value={Number(details?.slip?.taxableMonthly ?? slip.taxable_gross ?? 0)} />
        <Card label="Net à payer" value={Number(slip.net_to_pay ?? 0)} />
      </section>
      <Lines title="Gains" rows={earnings} />
      <Lines title="Retenues" rows={deductions.filter((row) => row.code !== "FRAIS_PRO" && row.code !== "FAMILLE" && Number(row.amount ?? 0) !== 0)} />
      <Lines title="Abattements IR" rows={[
        { label: "Frais professionnels", amount: details?.slip?.professionalExpense },
        { label: "Charges de famille", amount: details?.slip?.familyReduction },
      ].filter((row) => Number(row.amount ?? 0) !== 0)} />
      <Lines title="Charges patronales" rows={employer} />
      <p className="text-sm text-[var(--muted)]">CNSS {Number(slip.cnss_employee ?? 0).toFixed(2)} · AMO {Number(slip.amo_employee ?? 0).toFixed(2)} · IR {Number(slip.ir_amount ?? 0).toFixed(2)} · Avances et prêts {Number(slip.advance_deduction ?? 0).toFixed(2)} MAD. Bulletin préparatoire, pas une déclaration.</p>
    </ModulePage>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4"><p className="text-sm text-[var(--muted)]">{label}</p><p className="mt-1 text-xl font-semibold"><MoneyDisplay value={value} /></p></div>;
}

function Lines({ title, rows }: { title: string; rows: Line[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 divide-y divide-[var(--border)]">
        {rows.map((row, index) => (
          <li key={`${row.code ?? row.label}-${index}`} className="flex justify-between py-2 text-sm"><span>{row.label}</span><MoneyDisplay value={Number(row.amount ?? 0)} /></li>
        ))}
      </ul>
    </section>
  );
}
