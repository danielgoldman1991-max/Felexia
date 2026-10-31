/** Public messages for financial guards; database details stay on the server. */
export function financialErrorMessage(error: { code?: string; message?: string } | null | undefined, fallback = "L’opération n’a pas pu être enregistrée. Actualisez la page puis réessayez.") {
  const message = error?.message ?? "";
  if (message.includes("SUBSCRIPTION_WRITE_REQUIRED")) return "Votre espace est en consultation. Renouvelez votre essai ou abonnement pour enregistrer de nouvelles opérations.";
  if (message.includes("COMMERCIAL_DOCUMENT_LIMIT_REACHED")) return "La limite de documents commerciaux de votre offre pour ce mois est atteinte. Vos données restent consultables et exportables.";
  if (message.includes("FINANCE_POSTED_PAYMENT_READ_ONLY") || message.includes("OPERATOR_POSTED_PAYMENT_READ_ONLY")) return "Ce règlement est déjà comptabilisé. Son montant, son compte et son annulation sont verrouillés pour préserver le journal.";
  if (message.includes("FINANCE_MAD_ONLY")) return "Les règlements utilisent le dirham marocain (MAD). Sélectionnez un compte en MAD.";
  if (message.includes("FINANCE_ACCOUNT_CURRENCY_READ_ONLY")) return "La devise d’un compte existant est conservée pour préserver son historique. Créez un nouveau compte MAD pour vos nouveaux règlements.";
  if (message.includes("FINANCE_DRAFT_REQUIRED")) return "Seule une facture brouillon sans règlement peut être modifiée.";
  if (message.includes("FINANCE_DOCUMENT_NUMBER_READ_ONLY")) return "Le numéro attribué à une facture est conservé. Réglez uniquement le prochain compteur dans les paramètres.";
  if (message.includes("FINANCE_VALIDATED_INVOICE_READ_ONLY")) return "Cette facture est validée, réglée ou comptabilisée. Utilisez un avoir ou une écriture de correction pour préserver les documents et les journaux.";
  if (message.includes("FINANCE_RELATED_RECORD_INVALID")) return "Sélectionnez des clients, fournisseurs, articles et comptes appartenant à votre entreprise.";
  if (message.includes("FINANCE_SUPPLIER_REFERENCE_EXISTS")) return "Une facture avec ce numéro existe déjà pour ce fournisseur.";
  if (message.includes("FINANCE_ENTRY_UNBALANCED")) return "L’écriture doit avoir des débits et crédits équilibrés.";
  if (message.includes("FINANCE_POSTED_ENTRY_READ_ONLY")) return "Une écriture comptabilisée se corrige par une nouvelle écriture. Ses montants et son statut restent conservés.";
  if (message.includes("FINANCE_SOURCE_NOT_POSTABLE")) return "Le document source doit être validé et actif avant sa comptabilisation.";
  if (message.includes("FINANCE_SOURCE_AMOUNT_MISMATCH")) return "Le montant de l’écriture doit correspondre au document source. Vérifiez les lignes et les arrondis avant de comptabiliser.";
  if (message.includes("FINANCE_INVALID_DOCUMENT")) return "Vérifiez les lignes et les totaux de la facture. Enregistrez le brouillon avant de le valider.";
  if (message.includes("FINANCE_INVALID_LINE")) return "Vérifiez les descriptions, quantités, prix, remises et taux de TVA des lignes.";
  if (message.includes("FINANCE_WRITE_REQUIRED") || message.includes("FINANCE_ACCOUNTING_WRITE_REQUIRED") || error?.code === "42501") return "Votre profil ne permet pas cette modification.";
  if (error?.code === "PGRST202" || error?.code === "42883") return "La mise à jour de sécurité financière doit être activée avant cette opération.";
  return fallback;
}
