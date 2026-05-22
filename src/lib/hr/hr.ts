import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { ensureHrReferenceData } from "@/lib/hr/reference-data";
import type { HrDashboardData, HrEmployee, HrSettings } from "@/lib/hr/types";

type CountableTable =
  | "hr_employees"
  | "hr_contracts"
  | "hr_leave_requests"
  | "hr_absences"
  | "hr_advances"
  | "hr_loans";

type CountFilter =
  | "activeEmployees"
  | "newHires"
  | "trialContracts"
  | "contractsEndingSoon"
  | "pendingLeaves"
  | "absencesThisMonth"
  | "openAdvances"
  | "activeLoans";

export async function ensureCurrentWorkspaceHrReferenceData() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  await ensureHrReferenceData(supabase, workspace.organization.id);
  return workspace;
}

export async function getHrDashboardData(): Promise<HrDashboardData> {
  const workspace = await ensureCurrentWorkspaceHrReferenceData();
  const supabase = await createClient();
  const organizationId = workspace.organization.id;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    activeEmployees,
    newHires,
    trialContracts,
    contractsEndingSoon,
    pendingLeaves,
    absencesThisMonth,
    openAdvances,
    activeLoans,
    recentEmployeesResult,
    allEmployeesResult,
    departmentsResult,
    payrollResult,
  ] = await Promise.all([
    countRows(supabase, "hr_employees", organizationId, "activeEmployees", { monthStart, monthEnd, next30Days }),
    countRows(supabase, "hr_employees", organizationId, "newHires", { monthStart, monthEnd, next30Days }),
    countRows(supabase, "hr_contracts", organizationId, "trialContracts", { monthStart, monthEnd, next30Days }),
    countRows(supabase, "hr_contracts", organizationId, "contractsEndingSoon", { monthStart, monthEnd, next30Days }),
    countRows(supabase, "hr_leave_requests", organizationId, "pendingLeaves", { monthStart, monthEnd, next30Days }),
    countRows(supabase, "hr_absences", organizationId, "absencesThisMonth", { monthStart, monthEnd, next30Days }),
    countRows(supabase, "hr_advances", organizationId, "openAdvances", { monthStart, monthEnd, next30Days }),
    countRows(supabase, "hr_loans", organizationId, "activeLoans", { monthStart, monthEnd, next30Days }),
    supabase
      .from("hr_employees")
      .select("id, organization_id, employee_number, first_name, last_name, full_name, email, phone, city, hire_date, employment_status, cnss_number, rib, base_salary, department_id, position_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("hr_employees")
      .select("department_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    supabase
      .from("hr_departments")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    supabase
      .from("hr_payroll_periods")
      .select("total_gross,total_net")
      .eq("organization_id", organizationId)
      .eq("month", now.getUTCMonth() + 1)
      .eq("year", now.getUTCFullYear())
      .maybeSingle(),
  ]);

  const deptMap = new Map<string, string>();
  for (const d of departmentsResult.data ?? []) {
    if (d.id && d.name) deptMap.set(d.id, d.name);
  }

  const departmentCountMap = new Map<string, number>();
  for (const row of allEmployeesResult.data ?? []) {
    const name = row.department_id ? (deptMap.get(row.department_id) ?? "Non affecté") : "Non affecté";
    departmentCountMap.set(name, (departmentCountMap.get(name) ?? 0) + 1);
  }

  const rawRecent = (recentEmployeesResult.data ?? []) as Array<{
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
    employment_status: string;
    cnss_number: string | null;
    rib: string | null;
    base_salary: number;
    department_id: string | null;
    position_id: string | null;
  }>;

  const recentEmployees: HrEmployee[] = rawRecent.map((e) => ({
    id: e.id,
    organization_id: e.organization_id,
    employee_number: e.employee_number,
    first_name: e.first_name,
    last_name: e.last_name,
    full_name: e.full_name,
    email: e.email,
    phone: e.phone,
    city: e.city,
    hire_date: e.hire_date,
    employment_status: e.employment_status as HrEmployee["employment_status"],
    cnss_number: e.cnss_number,
    rib: e.rib,
    base_salary: e.base_salary,
    department: e.department_id ? { id: e.department_id, name: deptMap.get(e.department_id) ?? "" } : null,
    position: null,
  }));

  return {
    activeEmployees,
    newHires,
    trialContracts,
    contractsEndingSoon,
    pendingLeaves,
    absencesThisMonth,
    grossPayrollThisMonth: Number(payrollResult.data?.total_gross ?? 0),
    netPayrollThisMonth: Number(payrollResult.data?.total_net ?? 0),
    openAdvances,
    activeLoans,
    alerts: [
      ...(contractsEndingSoon > 0 ? [{ title: "Contrats à surveiller", description: `${contractsEndingSoon} contrat(s) expirent dans 30 jours.`, tone: "warning" as const }] : []),
      ...(pendingLeaves > 0 ? [{ title: "Congés en attente", description: `${pendingLeaves} demande(s) à traiter.`, tone: "info" as const }] : []),
      ...(recentEmployees.some((employee) => !employee.cnss_number) ? [{ title: "CNSS manquante", description: "Certains employés n'ont pas encore de numéro CNSS.", tone: "danger" as const }] : []),
      { title: "Calculs préparatoires", description: "Paie, CNSS/AMO et IR doivent être validés par votre conseiller social.", tone: "info" as const },
    ],
    departments: Array.from(departmentCountMap.entries()).map(([name, employees]) => ({ name, employees })),
    recentEmployees,
  };
}

export async function listHrEmployees(search?: string): Promise<HrEmployee[]> {
  const workspace = await ensureCurrentWorkspaceHrReferenceData();
  const supabase = await createClient();
  let query = supabase
    .from("hr_employees")
    .select("id, organization_id, employee_number, first_name, last_name, full_name, email, phone, city, hire_date, employment_status, cnss_number, rib, base_salary, department_id, position_id")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("employee_number", { ascending: true });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,employee_number.ilike.%${search}%,cin.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data: employeesData, error: employeesError } = await query;
  if (employeesError) throw new Error(employeesError.message);

  const [departmentsResult, positionsResult] = await Promise.all([
    supabase.from("hr_departments").select("id, name").eq("organization_id", workspace.organization.id).eq("is_active", true),
    supabase.from("hr_positions").select("id, title").eq("organization_id", workspace.organization.id).eq("is_active", true),
  ]);

  const deptMap = new Map<string, string>();
  for (const d of departmentsResult.data ?? []) {
    if (d.id && d.name) deptMap.set(d.id, d.name);
  }

  const posMap = new Map<string, string>();
  for (const p of positionsResult.data ?? []) {
    if (p.id && p.title) posMap.set(p.id, p.title);
  }

  const raw = (employeesData ?? []) as Array<{
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
    employment_status: string;
    cnss_number: string | null;
    rib: string | null;
    base_salary: number;
    department_id: string | null;
    position_id: string | null;
  }>;

  return raw.map((e) => ({
    id: e.id,
    organization_id: e.organization_id,
    employee_number: e.employee_number,
    first_name: e.first_name,
    last_name: e.last_name,
    full_name: e.full_name,
    email: e.email,
    phone: e.phone,
    city: e.city,
    hire_date: e.hire_date,
    employment_status: e.employment_status as HrEmployee["employment_status"],
    cnss_number: e.cnss_number,
    rib: e.rib,
    base_salary: e.base_salary,
    department: e.department_id ? { id: e.department_id, name: deptMap.get(e.department_id) ?? "" } : null,
    position: e.position_id ? { id: e.position_id, title: posMap.get(e.position_id) ?? "" } : null,
  }));
}

export async function getHrEmployeeDetail(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const organizationId = workspace.organization.id;
  const [employeeResult, contracts, leaves, absences, advances, loans, documents, evaluations, discipline] = await Promise.all([
    supabase
      .from("hr_employees")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("hr_contracts").select("*").eq("organization_id", organizationId).eq("employee_id", id).order("start_date", { ascending: false }),
    supabase.from("hr_leave_requests").select("*, leave_type:hr_leave_types(name,code)").eq("organization_id", organizationId).eq("employee_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("hr_absences").select("*").eq("organization_id", organizationId).eq("employee_id", id).order("absence_date", { ascending: false }).limit(8),
    supabase.from("hr_advances").select("*").eq("organization_id", organizationId).eq("employee_id", id).order("request_date", { ascending: false }).limit(8),
    supabase.from("hr_loans").select("*").eq("organization_id", organizationId).eq("employee_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("hr_documents").select("*").eq("organization_id", organizationId).eq("employee_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("hr_evaluations").select("*").eq("organization_id", organizationId).eq("employee_id", id).order("evaluation_date", { ascending: false }).limit(8),
    supabase.from("hr_disciplinary_actions").select("*").eq("organization_id", organizationId).eq("employee_id", id).order("action_date", { ascending: false }).limit(8),
  ]);

  if (!employeeResult.data) return null;

  const employee = employeeResult.data as Record<string, unknown> & {
    department_id?: string | null;
    position_id?: string | null;
  };

  const [deptResult, posResult] = await Promise.all([
    employee.department_id
      ? supabase.from("hr_departments").select("id, name").eq("id", employee.department_id).maybeSingle()
      : Promise.resolve({ data: null }),
    employee.position_id
      ? supabase.from("hr_positions").select("id, title").eq("id", employee.position_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const mappedEmployee = {
    ...employee,
    department: deptResult.data ? { id: deptResult.data.id, name: deptResult.data.name } : null,
    position: posResult.data ? { id: posResult.data.id, title: posResult.data.title } : null,
  };

  return {
    employee: mappedEmployee,
    contracts: contracts.data ?? [],
    leaves: leaves.data ?? [],
    absences: absences.data ?? [],
    advances: advances.data ?? [],
    loans: loans.data ?? [],
    documents: documents.data ?? [],
    evaluations: evaluations.data ?? [],
    discipline: discipline.data ?? [],
  };
}

export async function getHrReferenceData() {
  const workspace = await ensureCurrentWorkspaceHrReferenceData();
  const supabase = await createClient();
  const organizationId = workspace.organization.id;
  const [departments, positions, leaveTypes, settings] = await Promise.all([
    supabase.from("hr_departments").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    supabase.from("hr_positions").select("id,title").eq("organization_id", organizationId).eq("is_active", true).order("title"),
    supabase.from("hr_leave_types").select("id,name,code").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    supabase.from("hr_settings").select("*").eq("organization_id", organizationId).maybeSingle(),
  ]);

  return {
    workspace,
    departments: departments.data ?? [],
    positions: positions.data ?? [],
    leaveTypes: leaveTypes.data ?? [],
    settings: settings.data as HrSettings | null,
  };
}

export async function listHrTable(table: string, limit = 50) {
  const workspace = await ensureCurrentWorkspaceHrReferenceData();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: CountableTable,
  organizationId: string,
  filter: CountFilter,
  dates: { monthStart: string; monthEnd: string; next30Days: string },
): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq("organization_id", organizationId);

  if (filter === "activeEmployees") query = query.in("employment_status", ["active", "trial_period", "on_leave"]);
  if (filter === "newHires") query = query.gte("hire_date", dates.monthStart);
  if (filter === "trialContracts") query = query.eq("status", "active").not("trial_period_end", "is", null).lte("trial_period_end", dates.next30Days);
  if (filter === "contractsEndingSoon") query = query.eq("status", "active").not("end_date", "is", null).lte("end_date", dates.next30Days);
  if (filter === "pendingLeaves") query = query.eq("status", "pending");
  if (filter === "absencesThisMonth") query = query.gte("absence_date", dates.monthStart).lte("absence_date", dates.monthEnd).neq("status", "cancelled");
  if (filter === "openAdvances") query = query.in("status", ["approved", "paid"]);
  if (filter === "activeLoans") query = query.eq("status", "active");

  const { count } = await query;
  return count ?? 0;
}
