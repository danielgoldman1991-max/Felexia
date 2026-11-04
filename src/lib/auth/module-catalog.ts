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
