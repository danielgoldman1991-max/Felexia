export const ONBOARDING_CHECKS = [
  { key: "contrat", label: "Contrat signé et enregistré" },
  { key: "cin", label: "CIN vérifiée" },
  { key: "cnss", label: "Numéro CNSS renseigné" },
  { key: "rib", label: "RIB de paiement renseigné" },
  { key: "poste", label: "Poste et département affectés" },
  { key: "materiel", label: "Matériel remis" },
  { key: "acces", label: "Accès applicatifs créés hors Felexia si besoin" },
] as const;

export const OFFBOARDING_CHECKS = [
  { key: "date", label: "Date et motif de départ confirmés" },
  { key: "solde", label: "Solde de tout compte préparé" },
  { key: "conges", label: "Congés restants vérifiés" },
  { key: "materiel", label: "Matériel récupéré" },
  { key: "documents", label: "Attestations remises au salarié" },
  { key: "acces", label: "Accès externes désactivés" },
] as const;

export type CheckKind = "onboarding" | "offboarding";

export function checksFor(kind: CheckKind) {
  return kind === "onboarding" ? ONBOARDING_CHECKS : OFFBOARDING_CHECKS;
}

export function isCheckKey(kind: CheckKind, key: string) {
  return checksFor(kind).some((item) => item.key === key);
}
