import type { SupabaseClient } from "@supabase/supabase-js";

const departments = [
  "Direction",
  "Administration",
  "Commercial",
  "Finance",
  "Comptabilité",
  "Achats",
  "Stock / Logistique",
  "Production",
  "Support",
  "RH",
];

const positions = [
  "Directeur général",
  "Responsable administratif",
  "Comptable",
  "Commercial",
  "Responsable achats",
  "Magasinier",
  "Assistant administratif",
  "Technicien",
  "Responsable RH",
];

const leaveTypes = [
  { code: "ANNUAL", name: "Congé annuel", is_paid: true, annual_entitlement_days: 18, color: "#34D399" },
  { code: "SICK", name: "Maladie", is_paid: true, annual_entitlement_days: null, color: "#38BDF8" },
  { code: "MATERNITY", name: "Maternité", is_paid: true, annual_entitlement_days: null, color: "#A78BFA" },
  { code: "PATERNITY", name: "Paternité", is_paid: true, annual_entitlement_days: null, color: "#A78BFA" },
  { code: "FAMILY", name: "Événement familial", is_paid: true, annual_entitlement_days: null, color: "#D6B56D" },
  { code: "UNPAID", name: "Sans solde", is_paid: false, annual_entitlement_days: null, color: "#FBBF24" },
  { code: "AUTHORIZED", name: "Absence autorisée", is_paid: true, annual_entitlement_days: null, color: "#22D3EE" },
  { code: "UNJUSTIFIED", name: "Absence non justifiée", is_paid: false, annual_entitlement_days: null, color: "#F87171" },
];

const salaryItems = [
  { code: "BASE", label: "Salaire de base", item_type: "earning", calculation_type: "manual", taxable: true, subject_to_cnss: true, subject_to_amo: true },
  { code: "BONUS", label: "Prime exceptionnelle", item_type: "earning", calculation_type: "manual", taxable: true, subject_to_cnss: true, subject_to_amo: true },
  { code: "TRANSPORT", label: "Indemnité transport", item_type: "earning", calculation_type: "manual", taxable: false, subject_to_cnss: false, subject_to_amo: false },
  { code: "MEAL", label: "Indemnité repas", item_type: "earning", calculation_type: "manual", taxable: false, subject_to_cnss: false, subject_to_amo: false },
  { code: "OVERTIME", label: "Heures supplémentaires", item_type: "earning", calculation_type: "manual", taxable: true, subject_to_cnss: true, subject_to_amo: true },
  { code: "ABSENCE", label: "Retenue absence", item_type: "deduction", calculation_type: "manual", taxable: false, subject_to_cnss: false, subject_to_amo: false },
  { code: "ADVANCE", label: "Avance sur salaire", item_type: "deduction", calculation_type: "manual", taxable: false, subject_to_cnss: false, subject_to_amo: false },
  { code: "LOAN", label: "Remboursement prêt", item_type: "deduction", calculation_type: "manual", taxable: false, subject_to_cnss: false, subject_to_amo: false },
  { code: "CNSS_EMP", label: "CNSS salarié", item_type: "deduction", calculation_type: "percentage", taxable: false, subject_to_cnss: false, subject_to_amo: false },
  { code: "AMO_EMP", label: "AMO salarié", item_type: "deduction", calculation_type: "percentage", taxable: false, subject_to_cnss: false, subject_to_amo: false },
  { code: "IR", label: "IR salaire", item_type: "deduction", calculation_type: "formula", taxable: false, subject_to_cnss: false, subject_to_amo: false },
];

export async function ensureHrReferenceData(supabase: SupabaseClient, organizationId: string) {
  const now = new Date().toISOString();

  await supabase.from("hr_departments").upsert(
    departments.map((name) => ({
      organization_id: organizationId,
      name,
      code: name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "_"),
      updated_at: now,
    })),
    { onConflict: "organization_id,name" },
  );

  const { data: direction } = await supabase
    .from("hr_departments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", "Direction")
    .maybeSingle();

  await supabase.from("hr_positions").upsert(
    positions.map((title) => ({
      organization_id: organizationId,
      department_id: direction?.id ?? null,
      title,
      code: title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, "_"),
      updated_at: now,
    })),
    { onConflict: "organization_id,title" },
  );

  await supabase.from("hr_leave_types").upsert(
    leaveTypes.map((type) => ({ organization_id: organizationId, ...type })),
    { onConflict: "organization_id,code" },
  );

  await supabase.from("hr_salary_items").upsert(
    salaryItems.map((item) => ({
      organization_id: organizationId,
      default_amount: 0,
      default_rate: 0,
      is_active: true,
      ...item,
    })),
    { onConflict: "organization_id,code" },
  );

  await supabase.from("hr_settings").upsert(
    {
      organization_id: organizationId,
      default_weekly_hours: 44,
      default_annual_leave_days: 18,
      leave_accrual_days_per_month: 1.5,
      payroll_currency: "MAD",
      payroll_rounding: "nearest_cent",
      cnss_enabled: true,
      amo_enabled: true,
      ir_enabled: true,
      ir_brackets: [],
      payroll_rules: { schemaStatus: "preparatory", officialConformityClaim: false },
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
}
