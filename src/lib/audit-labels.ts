const ACTIONS: Record<string, string> = {
  create_role: "Création d'un rôle",
  delete_role: "Suppression d'un rôle",
  update_role_permissions: "Modification des droits",
  create_employee: "Création d'un salarié",
  update_employee: "Modification d'un salarié",
  invite_user: "Invitation d'un utilisateur",
  letter_accounting_lines: "Lettrage",
  payroll_calculated: "Calcul de la paie",
  payroll_paid: "Paiement de la paie",
  reconciliation_undone: "Annulation d'un rapprochement",
  reconciliation_confirmed: "Rapprochement bancaire",
};

const TABLES: Record<string, string> = {
  roles: "Rôles",
  hr_employees: "Salariés",
  hr_payslips: "Bulletins de paie",
  hr_payroll_periods: "Périodes de paie",
  invitations: "Invitations",
  bank_reconciliation_events: "Rapprochements",
  accounting_entry_lines: "Lignes d'écriture",
  settings: "Paramètres",
};

export function auditActionLabel(action: string | null | undefined) {
  if (!action) return "Action";
  return ACTIONS[action] ?? action.replaceAll("_", " ");
}

export function auditTableLabel(table: string | null | undefined) {
  if (!table) return "—";
  return TABLES[table] ?? table.replaceAll("_", " ");
}
