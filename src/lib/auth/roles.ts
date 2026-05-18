export type OrganizationRole = "owner" | "admin" | "manager" | "accountant" | "sales" | "viewer";

export const ORGANIZATION_ROLES: OrganizationRole[] = [
  "owner",
  "admin",
  "manager",
  "accountant",
  "sales",
  "viewer",
];

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  manager: "Responsable",
  accountant: "Comptable",
  sales: "Commercial",
  viewer: "Lecture seule",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: "Accès complet à l'organisation, aux utilisateurs et aux paramètres.",
  admin: "Gère les opérations et les utilisateurs.",
  manager: "Gère les ventes, achats, stock et trésorerie.",
  accountant: "Gère factures, paiements, comptabilité et TVA.",
  sales: "Gère prospects, clients, devis et commandes.",
  viewer: "Consulte les données sans modification.",
};

export const ADMIN_ROLES: OrganizationRole[] = ["owner", "admin"];

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role as OrganizationRole] ?? role;
}

export function getRoleDescription(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_DESCRIPTIONS[role as OrganizationRole] ?? "";
}

export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role as OrganizationRole);
}

export function normalizeRole(role: string | null | undefined): OrganizationRole {
  if (role === "admin") return "admin";
  return (role as OrganizationRole) ?? "viewer";
}
