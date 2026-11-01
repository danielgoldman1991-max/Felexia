/** Fail closed: these operations never fall back to separate database writes. */
export function proTransactionError(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (error?.code === "PGRST202" || error?.code === "42883") return "L’enregistrement sécurisé de ce module doit être activé avant cette opération. Contactez votre administrateur.";
  if (message.includes("DOCUMENT_CHANGED") || message.includes("PERIOD_CHANGED") || error?.code === "40001") return "Ce document a changé depuis son ouverture. Actualisez avant de réessayer ; vos anciennes données ont été conservées.";
  if (message.includes("DRAFT_REQUIRED")) return "Seul un brouillon actif peut être modifié.";
  if (message.includes("PAYROLL_SETTINGS_REQUIRED") || message.includes("PAYROLL_IR_BRACKET_MISSING")) return "Le calcul est bloqué : configurez et faites vérifier les taux sociaux, le plafond CNSS et le barème IR nécessaires. Aucun bulletin n’a été enregistré.";
  if (message.includes("PAYROLL_BASE_ONLY_ACK_REQUIRED") || message.includes("PAYROLL_PREPARATORY_ONLY")) return "Seule une préparation du salaire de base est disponible. Les variables, la validation finale et le paiement sont exclus.";
  if (message.includes("PAYROLL_PERIOD_FINALIZED") || message.includes("PAYROLL_EXISTING_SLIPS_LOCKED")) return "Cette période ou certains bulletins sont finalisés ou ne correspondent plus aux salariés actifs. Aucun recalcul n’a été enregistré.";
  if (message.includes("PAYROLL_INVALID_SALARY") || message.includes("PAYROLL_INVALID_NET")) return "Un montant de salaire est invalide. Corrigez le dossier avant de calculer ; aucun bulletin n’a été enregistré.";
  if (error?.code === "42501") return "Votre profil, votre offre ou l’échéance de votre abonnement ne permet pas cette opération.";
  if (message.includes("RELATED_RECORD_INVALID")) return "Sélectionnez des tiers, articles, unités et taux appartenant à votre entreprise.";
  if (message.includes("INVALID_LINE") || message.includes("INVALID_DOCUMENT") || message.includes("INDIVISIBLE_QUANTITY") || error?.code === "23514" || error?.code === "22P02" || error?.code === "22003") return "Vérifiez les descriptions, quantités, montants, remises, taux et dates. Les données précédentes ont été conservées.";
  return "L’opération n’a pas pu être enregistrée. Les données précédentes ont été conservées. Actualisez puis réessayez.";
}
