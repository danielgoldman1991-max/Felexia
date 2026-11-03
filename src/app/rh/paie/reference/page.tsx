import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { listHrEmployees } from "@/lib/hr/hr";
import { calculateMoroccanPayslip2026, MA_PAYROLL_2026 } from "@/lib/hr/ma-payroll-2026";

export const dynamic = "force-dynamic";

export default async function PayrollReferencePage() {
  const employees = await listHrEmployees();
  const today = new Date().toISOString().slice(0, 10);
  const rows = employees.map((employee) => ({
    name: employee.full_name,
    slip: calculateMoroccanPayslip2026({
      baseSalary: Number(employee.base_salary ?? 0),
      hireDate: employee.hire_date,
      periodDate: today,
    }),
  }));
  return (
    <ModulePage>
      <PageHeader title="Bulletin de référence 2026" description="CNSS 4,48 % plafonnée à 6 000 MAD, AMO 2,26 %, frais professionnels 35 % / 25 %, barème IR art. 73 et prime d'ancienneté. Simulation non déclarée à la CNSS." />
      <p className="text-sm text-[var(--muted)]">Plafond CNSS {MA_PAYROLL_2026.cnssMonthlyCeiling.toLocaleString("fr-MA")} MAD. Charges de famille : {MA_PAYROLL_2026.familyReductionMonthly} MAD par personne et par mois, six au plus. Le bulletin enregistré par la paie préparatoire reste limité au salaire de base.</p>
      <div className="mt-4 overflow-x-auto">
        <Table className="min-w-[960px]">
          <thead><tr><Th>Salarié</Th><Th className="text-right">Base</Th><Th className="text-right">Ancienneté</Th><Th className="text-right">CNSS</Th><Th className="text-right">AMO</Th><Th className="text-right">IR</Th><Th className="text-right">Net</Th><Th className="text-right">Coût employeur</Th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><Td colSpan={8}>Aucun salarié.</Td></tr> : rows.map((row) => (
              <tr key={row.name}>
                <Td>{row.name}</Td>
                <Td className="text-right"><MoneyDisplay value={row.slip.baseSalary} /></Td>
                <Td className="text-right">{row.slip.seniorityPercent} %</Td>
                <Td className="text-right"><MoneyDisplay value={row.slip.cnssEmployee} /></Td>
                <Td className="text-right"><MoneyDisplay value={row.slip.amoEmployee} /></Td>
                <Td className="text-right"><MoneyDisplay value={row.slip.ir} /></Td>
                <Td className="text-right"><MoneyDisplay value={row.slip.net} /></Td>
                <Td className="text-right"><MoneyDisplay value={row.slip.employerCost} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </ModulePage>
  );
}
