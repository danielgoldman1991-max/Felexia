import { MA_PAYROLL_2026 } from "@/lib/hr/ma-payroll-2026";

/** Barème mensuel dérivé du barème annuel, pour le contrôle SQL des paramètres. Le calcul des bulletins utilise le référentiel annuel 2026. */
const MONTHLY_IR = [
  { from: 0, to: 3333.33, rate: 0, deduction: 0 },
  { from: 3333.34, to: 5000, rate: 10, deduction: 333.33 },
  { from: 5000.01, to: 6666.67, rate: 20, deduction: 833.33 },
  { from: 6666.68, to: 8333.33, rate: 30, deduction: 1500 },
  { from: 8333.34, to: 15000, rate: 34, deduction: 1833.33 },
  { from: 15000.01, to: null, rate: 37, deduction: 2283.33 },
];

export function payrollReference2026Settings(organizationId: string) {
  return {
    organization_id: organizationId,
    default_weekly_hours: 44,
    default_annual_leave_days: MA_PAYROLL_2026.annualLeaveDays,
    leave_accrual_days_per_month: 1.5,
    payroll_currency: "MAD",
    payroll_rounding: "nearest_cent",
    cnss_enabled: true,
    amo_enabled: true,
    ir_enabled: true,
    cnss_employee_rate: MA_PAYROLL_2026.cnssEmployeeRate,
    cnss_employer_rate: Math.round((MA_PAYROLL_2026.cnssEmployerSocialRate + MA_PAYROLL_2026.cnssEmployerFamilyRate) * 100) / 100,
    amo_employee_rate: MA_PAYROLL_2026.amoEmployeeRate,
    amo_employer_rate: MA_PAYROLL_2026.amoEmployerRate,
    cnss_monthly_ceiling: MA_PAYROLL_2026.cnssMonthlyCeiling,
    ir_brackets: MONTHLY_IR,
    payroll_rules: { schemaStatus: "reference_2026", officialConformityClaim: false, source: "MA_PAYROLL_2026" },
    updated_at: new Date().toISOString(),
  };
}
