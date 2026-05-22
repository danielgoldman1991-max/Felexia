export type HrEmployeeStatus = "active" | "trial_period" | "suspended" | "on_leave" | "terminated" | "archived";
export type HrPayrollStatus = "draft" | "calculated" | "validated" | "paid" | "archived";

export type HrEmployee = {
  id: string;
  organization_id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  hire_date: string;
  employment_status: HrEmployeeStatus;
  cnss_number: string | null;
  rib: string | null;
  base_salary: number;
  department?: { id: string; name: string } | null;
  position?: { id: string; title: string } | null;
};

export type HrDashboardData = {
  activeEmployees: number;
  newHires: number;
  trialContracts: number;
  contractsEndingSoon: number;
  pendingLeaves: number;
  absencesThisMonth: number;
  grossPayrollThisMonth: number;
  netPayrollThisMonth: number;
  openAdvances: number;
  activeLoans: number;
  alerts: Array<{ title: string; description: string; tone: "warning" | "danger" | "info" }>;
  departments: Array<{ name: string; employees: number }>;
  recentEmployees: HrEmployee[];
};

export type HrSettings = {
  default_weekly_hours?: number | null;
  default_annual_leave_days?: number | null;
  leave_accrual_days_per_month?: number | null;
  cnss_enabled: boolean | null;
  amo_enabled: boolean | null;
  ir_enabled: boolean | null;
  cnss_employee_rate: number | null;
  cnss_employer_rate: number | null;
  amo_employee_rate: number | null;
  amo_employer_rate: number | null;
  cnss_monthly_ceiling: number | null;
  ir_brackets: Array<{ from: number; to?: number | null; rate: number; deduction?: number }>;
};
