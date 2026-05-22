import type { HrSettings } from "@/lib/hr/types";

type PayrollEmployee = {
  id: string;
  full_name?: string | null;
  base_salary?: number | null;
};

type PayrollVariables = {
  overtimeAmount?: number;
  bonuses?: number;
  indemnities?: number;
  absenceDeduction?: number;
  advanceDeduction?: number;
  loanDeduction?: number;
  otherDeductions?: number;
};

export function roundPayrollAmount(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculatePayslip(
  employee: PayrollEmployee,
  settings: HrSettings | null,
  variables: PayrollVariables = {},
) {
  const warnings: string[] = [];
  const baseSalary = roundPayrollAmount(Number(employee.base_salary ?? 0));
  const bonusAmount = roundPayrollAmount(Number(variables.bonuses ?? 0));
  const overtimeAmount = roundPayrollAmount(Number(variables.overtimeAmount ?? 0));
  const indemnities = roundPayrollAmount(Number(variables.indemnities ?? 0));

  const grossSalary = roundPayrollAmount(baseSalary + bonusAmount + overtimeAmount + indemnities);
  const cnssBase = settings?.cnss_monthly_ceiling
    ? Math.min(grossSalary, Number(settings.cnss_monthly_ceiling))
    : grossSalary;

  const cnssEmployeeRate = Number(settings?.cnss_employee_rate ?? 0);
  const cnssEmployerRate = Number(settings?.cnss_employer_rate ?? 0);
  const amoEmployeeRate = Number(settings?.amo_employee_rate ?? 0);
  const amoEmployerRate = Number(settings?.amo_employer_rate ?? 0);

  if (settings?.cnss_enabled && !settings.cnss_employee_rate) warnings.push("Taux CNSS salarié non configuré.");
  if (settings?.amo_enabled && !settings.amo_employee_rate) warnings.push("Taux AMO salarié non configuré.");
  if (settings?.ir_enabled && (!settings.ir_brackets || settings.ir_brackets.length === 0)) {
    warnings.push("Barème IR non configuré.");
  }

  const cnssEmployee = settings?.cnss_enabled ? roundPayrollAmount(cnssBase * cnssEmployeeRate / 100) : 0;
  const amoEmployee = settings?.amo_enabled ? roundPayrollAmount(grossSalary * amoEmployeeRate / 100) : 0;
  const taxableGross = roundPayrollAmount(grossSalary - cnssEmployee - amoEmployee);
  const irAmount = settings?.ir_enabled ? calculateIrAmount(taxableGross, settings.ir_brackets ?? []) : 0;

  const advanceDeduction = roundPayrollAmount(Number(variables.advanceDeduction ?? 0));
  const loanDeduction = roundPayrollAmount(Number(variables.loanDeduction ?? 0));
  const absenceDeduction = roundPayrollAmount(Number(variables.absenceDeduction ?? 0));
  const otherDeductions = roundPayrollAmount(Number(variables.otherDeductions ?? 0));
  const totalDeductions = roundPayrollAmount(cnssEmployee + amoEmployee + irAmount + advanceDeduction + loanDeduction + absenceDeduction + otherDeductions);
  const netSalary = roundPayrollAmount(grossSalary - totalDeductions);

  const cnssEmployer = settings?.cnss_enabled ? roundPayrollAmount(cnssBase * cnssEmployerRate / 100) : 0;
  const amoEmployer = settings?.amo_enabled ? roundPayrollAmount(grossSalary * amoEmployerRate / 100) : 0;
  const employerCost = roundPayrollAmount(grossSalary + cnssEmployer + amoEmployer);

  return {
    earnings: [
      { code: "BASE", label: "Salaire de base", amount: baseSalary },
      { code: "BONUS", label: "Primes", amount: bonusAmount },
      { code: "OVERTIME", label: "Heures supplémentaires", amount: overtimeAmount },
      { code: "INDEMNITIES", label: "Indemnités", amount: indemnities },
    ].filter((item) => item.amount !== 0),
    deductions: [
      { code: "CNSS_EMP", label: "CNSS salarié", amount: cnssEmployee },
      { code: "AMO_EMP", label: "AMO salarié", amount: amoEmployee },
      { code: "IR", label: "IR salaire préparatoire", amount: irAmount },
      { code: "ABSENCE", label: "Retenue absence", amount: absenceDeduction },
      { code: "ADVANCE", label: "Avance sur salaire", amount: advanceDeduction },
      { code: "LOAN", label: "Remboursement prêt", amount: loanDeduction },
      { code: "OTHER", label: "Autres retenues", amount: otherDeductions },
    ].filter((item) => item.amount !== 0),
    employerContributions: [
      { code: "CNSS_ER", label: "CNSS employeur", amount: cnssEmployer },
      { code: "AMO_ER", label: "AMO employeur", amount: amoEmployer },
    ].filter((item) => item.amount !== 0),
    grossSalary,
    taxableGross,
    netSalary,
    netToPay: netSalary,
    employerCost,
    cnssEmployee,
    amoEmployee,
    irAmount,
    cnssEmployer,
    amoEmployer,
    calculationDetails: {
      schemaStatus: "preparatory",
      officialConformityClaim: false,
      warnings,
    },
    warnings,
  };
}

function calculateIrAmount(taxableGross: number, brackets: HrSettings["ir_brackets"]): number {
  const bracket = brackets.find((item) => taxableGross >= Number(item.from) && (item.to == null || taxableGross <= Number(item.to)));
  if (!bracket) return 0;
  return roundPayrollAmount(Math.max(0, taxableGross * Number(bracket.rate ?? 0) / 100 - Number(bracket.deduction ?? 0)));
}
