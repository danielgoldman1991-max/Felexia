export const PAYMENT_TERMS_OPTIONS = [
  { value: "immediate", label: "Paiement immédiat" },
  { value: "on_receipt", label: "À réception" },
  { value: "end_of_month", label: "Fin de mois" },
  { value: "days_7", label: "7 jours" },
  { value: "days_15", label: "15 jours" },
  { value: "days_30", label: "30 jours" },
  { value: "days_45", label: "45 jours" },
  { value: "days_60", label: "60 jours" },
  { value: "days_90", label: "90 jours" },
  { value: "days_120", label: "120 jours" },
  { value: "days_30_end_of_month", label: "30 jours fin de mois" },
  { value: "days_45_end_of_month", label: "45 jours fin de mois" },
  { value: "days_60_end_of_month", label: "60 jours fin de mois" },
  { value: "multiple_installments", label: "Paiement en plusieurs échéances" },
  { value: "custom", label: "Paiement personnalisé" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Espèces" },
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "check", label: "Chèque" },
  { value: "certified_check", label: "Chèque certifié" },
  { value: "bill_of_exchange", label: "Effet / Lettre de change" },
  { value: "card", label: "Carte bancaire" },
  { value: "mobile_payment", label: "Paiement mobile" },
  { value: "paypal", label: "PayPal" },
  { value: "direct_debit", label: "Prélèvement automatique" },
  { value: "bank_deposit", label: "Dépôt bancaire" },
  { value: "cash_on_delivery", label: "Paiement à la livraison" },
  { value: "installments", label: "Paiement échelonné" },
  { value: "mixed", label: "Mixte (plusieurs moyens)" },
  { value: "other", label: "Autre" },
] as const;

export type PaymentTermValue = (typeof PAYMENT_TERMS_OPTIONS)[number]["value"];
export type PaymentMethodValue = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];
