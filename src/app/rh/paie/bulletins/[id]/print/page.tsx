import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { documentIdentityContact, documentIdentityInfoLines } from "@/lib/print-format";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintTotals } from "@/components/print/PrintTotals";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintFooter } from "@/components/print/PrintFooter";
import { formatMoney } from "@/lib/format";
import { payslipStatusLabel } from "@/lib/hr/payslip-lifecycle";

type MoneyLine = { label?: string; amount?: number };

export default async function HrPayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);
  const supabase = await createClient();
  const { data: slip } = await supabase
    .from("hr_payslips")
    .select("payslip_number, status, gross_salary, net_to_pay, net_salary, taxable_gross, ir_amount, cnss_employee, amo_employee, base_salary, advance_deduction, earnings, deductions, employer_contributions, calculation_details, employee_id, payroll_period_id")
    .eq("id", id)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  const [{ data: employee }, { data: period }] = await Promise.all([
    slip?.employee_id
      ? supabase.from("hr_employees").select("first_name, last_name, cin, cnss_number, hire_date, employee_number").eq("id", slip.employee_id).eq("organization_id", workspace.organization.id).maybeSingle()
      : Promise.resolve({ data: null }),
    slip?.payroll_period_id
      ? supabase.from("hr_payroll_periods").select("month, year, period_start, period_end").eq("id", slip.payroll_period_id).eq("organization_id", workspace.organization.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const earnings = Array.isArray(slip?.earnings) ? slip.earnings as MoneyLine[] : [];
  const deductions = Array.isArray(slip?.deductions) ? slip.deductions as MoneyLine[] : [];
  const employer = Array.isArray(slip?.employer_contributions) ? slip.employer_contributions as MoneyLine[] : [];
  const companyContact = documentIdentityContact(identity);
  const employeeName = `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() || "Salarié";
  const locked = slip?.status === "validated" || slip?.status === "paid";
  return (
    <div className="print-preview">
      <PrintActions backHref={`/rh/paie/bulletins/${id}`} backLabel="Retour au bulletin" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={companyContact} />
          <PrintDocumentTitle title="Bulletin de paie" documentNumber={slip?.payslip_number ?? id}>
            <p>Période : {period ? `${String(period.month).padStart(2, "0")}/${period.year}` : "—"}</p>
            <p>Statut : {payslipStatusLabel(String(slip?.status ?? "draft"))}{locked ? " · montants figés" : ""}</p>
          </PrintDocumentTitle>
        </PrintHeader>
        <PrintTerms title="Salarié">
          {employeeName} · Matricule {employee?.employee_number ?? "—"} · CIN {employee?.cin ?? "—"} · N° CNSS {employee?.cnss_number ?? "—"} · Entrée {employee?.hire_date ?? "—"}
        </PrintTerms>
        <PrintLineTable currency="MAD" head={<><th>Élément</th><th className="right">Montant</th></>}>
          {earnings.map((line, index) => (
            <tr key={`e-${index}`}><td>{line.label ?? "Gain"}</td><td className="right">{formatMoney(Number(line.amount ?? 0))}</td></tr>
          ))}
          {deductions.filter((line) => !/frais professionnels|charges de famille/i.test(line.label ?? "")).map((line, index) => (
            <tr key={`d-${index}`}><td>{line.label ?? "Retenue"}</td><td className="right">{formatMoney(Number(line.amount ?? 0))}</td></tr>
          ))}
        </PrintLineTable>
        <PrintTotals
          rows={[
            { label: "Salaire brut", value: formatMoney(Number(slip?.gross_salary ?? 0)) },
            { label: "CNSS salarié", value: formatMoney(Number(slip?.cnss_employee ?? 0)) },
            { label: "AMO salarié", value: formatMoney(Number(slip?.amo_employee ?? 0)) },
            { label: "Abattement frais professionnels", value: formatMoney(Number((slip?.calculation_details as { slip?: { professionalExpense?: number } } | null)?.slip?.professionalExpense ?? 0)) },
            { label: "Net imposable", value: formatMoney(Number(slip?.taxable_gross ?? 0)) },
            { label: "IR", value: formatMoney(Number(slip?.ir_amount ?? 0)) },
            { label: "Charges de famille", value: formatMoney(Number((slip?.calculation_details as { slip?: { familyReduction?: number } } | null)?.slip?.familyReduction ?? 0)) },
            { label: "Avances et prêts", value: formatMoney(Number((slip as { advance_deduction?: number } | null)?.advance_deduction ?? 0)) },
          ]}
          grandTotalLabel="Net à payer"
          grandTotalValue={formatMoney(Number(slip?.net_to_pay ?? slip?.net_salary ?? 0))}
        />
        <PrintTerms title="Charges patronales">
          {employer.map((line) => `${line.label ?? "Charge"} ${formatMoney(Number(line.amount ?? 0))}`).join(" · ") || "Aucune charge patronale enregistrée."}
        </PrintTerms>
        <PrintTerms title="Mentions légales">
          Bulletin de paie établi en dirhams (MAD) à partir des éléments enregistrés dans Felexia. L’employeur conserve un exemplaire. Ce document ne constitue ni une déclaration CNSS, ni un état 9421, ni un dépôt DGI.
          {locked ? " Les montants sont figés depuis la validation." : " Le bulletin n’est pas encore validé."}
        </PrintTerms>
        <PrintFooter footerText={identity.footerText} name={identity.name} contact={companyContact} />
      </PrintPage>
    </div>
  );
}
