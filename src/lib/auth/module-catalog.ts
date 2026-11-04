export const MODULE_ACCESS = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "ventes", label: "Ventes" },
  { key: "achats", label: "Achats" },
  { key: "stock", label: "Stock" },
  { key: "tresorerie", label: "Trésorerie" },
  { key: "comptabilite", label: "Comptabilité" },
  { key: "tva", label: "TVA" },
  { key: "rh", label: "RH" },
  { key: "paie", label: "Paie" },
  { key: "parametres", label: "Paramètres" },
] as const;

export type ModuleKey = (typeof MODULE_ACCESS)[number]["key"];

const ADMIN_ROLE_NAMES = new Set(["owner", "admin", "administrateur", "proprietaire", "propriétaire"]);
const MODULE_CODE = /^(dashboard|ventes|achats|stock|tresorerie|comptabilite|tva|rh|paie|parametres)\.(read|write)$/;

export function isBuiltInAdminRoleName(role: string | null | undefined) {
  return ADMIN_ROLE_NAMES.has((role ?? "").trim().toLowerCase());
}

/** Roles with no module codes keep the legacy role checks. A filled matrix is enforced. */
export function decideModuleAccess(role: string | null | undefined, codes: Iterable<string>, module: ModuleKey, level: "read" | "write"): "allow" | "deny" | "legacy" {
  if (isBuiltInAdminRoleName(role)) return "allow";
  const matrix = [...codes].filter((code) => MODULE_CODE.test(code));
  if (matrix.length === 0) return "legacy";
  const granted = new Set(matrix);
  const allowed = level === "read"
    ? granted.has(`${module}.read`) || granted.has(`${module}.write`)
    : granted.has(`${module}.write`);
  return allowed ? "allow" : "deny";
}
