const ACTIONS: Record<string, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  insert: "Création",
  archive: "Archivage",
  restore: "Restauration",
  stock_transfer: "Transfert de stock",
  payroll_calculated: "Calcul de la paie",
  payroll_validated: "Validation de la paie",
  payroll_paid: "Paiement de la paie",
  letter_accounting_lines: "Lettrage",
  unletter_accounting_lines: "Délettrage",
  reconciliation_undone: "Annulation d'un rapprochement",
  reconciliation_confirmed: "Rapprochement bancaire",
  create_role: "Création d'un rôle",
  delete_role: "Suppression d'un rôle",
  update_role_permissions: "Modification des droits",
  create_employee: "Création d'un salarié",
  update_employee: "Modification d'un salarié",
  invite_user: "Invitation d'un utilisateur",
  disable_user: "Désactivation d'un utilisateur",
  remove_user: "Retrait d'un utilisateur",
  open_fiscal_year: "Ouverture d'un exercice",
  activate_plan: "Activation d'une offre",
  create_third_party: "Création d'un tiers",
  update_third_party: "Modification d'un tiers",
  create_customer_invoice: "Création d'une facture client",
  invoice_validated: "Validation d'une facture",
  invoice_sent: "Envoi d'une facture",
  invoice_paid: "Règlement d'une facture",
  invoice_cancelled: "Annulation d'une facture",
  update_company_settings: "Modification des informations de l'entreprise",
  update_document_settings: "Modification des paramètres de documents",
  change_subscription: "Changement d'abonnement",
};

const TABLES: Record<string, string> = {
  roles: "Rôles",
  hr_employees: "Salariés",
  hr_payslips: "Bulletins de paie",
  hr_payroll_periods: "Périodes de paie",
  invitations: "Invitations",
  bank_reconciliation_events: "Rapprochements",
  accounting_entry_lines: "Lignes d'écriture",
  accounting_entries: "Écritures",
  accounting_fiscal_years: "Exercices",
  customer_invoices: "Factures clients",
  third_parties: "Tiers",
  third_party: "Tiers",
  tiers: "Tiers",
  stock_moves: "Mouvements de stock",
  settings: "Paramètres",
  profiles: "Profils",
  organization_subscriptions: "Abonnements",
};

const TOKENS: Record<string, string> = {
  create: "création",
  update: "modification",
  delete: "suppression",
  payroll: "paie",
  calculated: "calculée",
  validated: "validée",
  paid: "payée",
  letter: "lettrage",
  accounting: "comptable",
  lines: "lignes",
  stock: "stock",
  transfer: "transfert",
  invoice: "facture",
  customer: "client",
  supplier: "fournisseur",
  employee: "salarié",
  invite: "invitation",
  user: "utilisateur",
  role: "rôle",
  reconciliation: "rapprochement",
  undone: "annulé",
  confirmed: "confirmé",
};

export function auditActionLabel(action: string | null | undefined) {
  if (!action) return "Action";
  if (ACTIONS[action]) return ACTIONS[action];
  const words = action.split("_").filter(Boolean).map((token) => TOKENS[token] ?? token);
  if (words.length === 0) return "Action";
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function auditTableLabel(table: string | null | undefined) {
  if (!table) return "—";
  const key = table.trim().toLowerCase().replaceAll(" ", "_");
  return TABLES[key] ?? TABLES[table] ?? table.replaceAll("_", " ");
}

export function formatAuditTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(date);
}
