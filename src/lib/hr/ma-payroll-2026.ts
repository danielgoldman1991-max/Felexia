/**
 * Référence de paie marocaine 2026, pour simulation.
 * Sources utilisées : CGI art. 59 (frais professionnels) et art. 73 (barème,
 * inchangé par la loi de finances 2026), cotisations CNSS/AMO inchangées
 * depuis 2024, réduction pour charges de famille de 50 MAD par mois et par
 * personne à charge (six au plus) à compter du 1er janvier 2026.
 * Ce n'est pas une déclaration Damancom ni un bulletin opposable.
 */
export const MA_PAYROLL_2026 = {
  label: "Référence 2026",
  cnssEmployeeRate: 4.48,
  cnssEmployerSocialRate: 8.98,
  cnssEmployerFamilyRate: 6.4,
  cnssMonthlyCeiling: 6000,
  trainingTaxRate: 1.6,
  amoEmployeeRate: 2.26,
  amoEmployerRate: 4.11,
  professionalExpenseFullRate: 0.35,
  professionalExpenseReducedRate: 0.25,
  professionalExpenseAnnualThreshold: 78_000,
  professionalExpenseAnnualCap: 35_000,
  familyReductionMonthly: 50,
  familyReductionMaxDependents: 6,
  annualLeaveDays: 18,
} as const;

const IR_ANNUAL = [
  { to: 40_000, rate: 0, deduction: 0 },
  { to: 60_000, rate: 10, deduction: 4_000 },
  { to: 80_000, rate: 20, deduction: 10_000 },
  { to: 100_000, rate: 30, deduction: 18_000 },
  { to: 180_000, rate: 34, deduction: 22_000 },
  { to: Number.POSITIVE_INFINITY, rate: 37, deduction: 27_400 },
] as const;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Prime d'ancienneté du code du travail : 5, 10, 15, 20 puis 25 % du salaire de base. */
export function seniorityRate(completedYears: number): number {
  if (completedYears >= 25) return 25;
  if (completedYears >= 20) return 20;
  if (completedYears >= 12) return 15;
  if (completedYears >= 5) return 10;
  if (completedYears >= 2) return 5;
  return 0;
}

export function completedYears(hireDate: string, onDate: string): number {
  const hire = new Date(`${hireDate}T00:00:00Z`);
  const on = new Date(`${onDate}T00:00:00Z`);
  if (Number.isNaN(hire.getTime()) || Number.isNaN(on.getTime()) || on < hire) return 0;
  let years = on.getUTCFullYear() - hire.getUTCFullYear();
  const beforeAnniversary = on.getUTCMonth() < hire.getUTCMonth()
    || (on.getUTCMonth() === hire.getUTCMonth() && on.getUTCDate() < hire.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

export type MoroccanPayslipInput = {
  baseSalary: number;
  hireDate?: string | null;
  periodDate?: string;
  bonuses?: number;
  overtimeAmount?: number;
  indemnities?: number;
  absenceDeduction?: number;
  dependents?: number;
};

export function calculateMoroccanPayslip2026(input: MoroccanPayslipInput) {
  const warnings = [
    "Simulation de référence 2026. Elle ne remplace pas le bulletin persisté (salaire de base seul) ni une déclaration CNSS.",
  ];
  const baseSalary = roundMoney(Math.max(0, input.baseSalary));
  const years = input.hireDate ? completedYears(input.hireDate, input.periodDate ?? new Date().toISOString().slice(0, 10)) : 0;
  const seniorityPercent = seniorityRate(years);
  const seniorityBonus = roundMoney(baseSalary * seniorityPercent / 100);
  const bonuses = roundMoney(Math.max(0, input.bonuses ?? 0));
  const overtime = roundMoney(Math.max(0, input.overtimeAmount ?? 0));
  const indemnities = roundMoney(Math.max(0, input.indemnities ?? 0));
  const absence = roundMoney(Math.max(0, input.absenceDeduction ?? 0));
  const gross = roundMoney(baseSalary + seniorityBonus + bonuses + overtime + indemnities - absence);

  const cnssBase = Math.min(gross, MA_PAYROLL_2026.cnssMonthlyCeiling);
  const cnssEmployee = roundMoney(cnssBase * MA_PAYROLL_2026.cnssEmployeeRate / 100);
  const amoEmployee = roundMoney(gross * MA_PAYROLL_2026.amoEmployeeRate / 100);
  const annualGross = roundMoney(gross * 12);
  const professionalAnnual = annualGross <= MA_PAYROLL_2026.professionalExpenseAnnualThreshold
    ? annualGross * MA_PAYROLL_2026.professionalExpenseFullRate
    : Math.min(annualGross * MA_PAYROLL_2026.professionalExpenseReducedRate, MA_PAYROLL_2026.professionalExpenseAnnualCap);
  const professionalExpense = roundMoney(professionalAnnual / 12);
  const taxableMonthly = roundMoney(Math.max(0, gross - cnssEmployee - amoEmployee - professionalExpense));
  const taxableAnnual = roundMoney(taxableMonthly * 12);
  const annualIr = IR_ANNUAL.find((bracket) => taxableAnnual <= bracket.to) ?? IR_ANNUAL[IR_ANNUAL.length - 1];
  const irBeforeFamily = roundMoney(Math.max(0, taxableAnnual * annualIr.rate / 100 - annualIr.deduction) / 12);
  const dependents = Math.min(MA_PAYROLL_2026.familyReductionMaxDependents, Math.max(0, Math.floor(input.dependents ?? 0)));
  const familyReduction = roundMoney(Math.min(irBeforeFamily, dependents * MA_PAYROLL_2026.familyReductionMonthly));
  const ir = roundMoney(irBeforeFamily - familyReduction);
  const net = roundMoney(gross - cnssEmployee - amoEmployee - ir);

  const cnssEmployerSocial = roundMoney(cnssBase * MA_PAYROLL_2026.cnssEmployerSocialRate / 100);
  const cnssEmployerFamily = roundMoney(cnssBase * MA_PAYROLL_2026.cnssEmployerFamilyRate / 100);
  const trainingTax = roundMoney(gross * MA_PAYROLL_2026.trainingTaxRate / 100);
  const amoEmployer = roundMoney(gross * MA_PAYROLL_2026.amoEmployerRate / 100);
  const employerCost = roundMoney(gross + cnssEmployerSocial + cnssEmployerFamily + trainingTax + amoEmployer);

  return {
    baseSalary,
    seniorityYears: years,
    seniorityPercent,
    seniorityBonus,
    gross,
    cnssEmployee,
    amoEmployee,
    professionalExpense,
    taxableMonthly,
    ir,
    familyReduction,
    net,
    cnssEmployerSocial,
    cnssEmployerFamily,
    trainingTax,
    amoEmployer,
    employerCost,
    warnings,
  };
}
