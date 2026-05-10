export const SUPPLIER_CATEGORY_OPTIONS = [
  { value: "informatique", label: "Produits informatiques" },
  { value: "bureautique", label: "Matériel bureautique" },
  { value: "mobilier", label: "Mobilier" },
  { value: "fournitures", label: "Fournitures de bureau" },
  { value: "prestation", label: "Prestations de service" },
  { value: "maintenance", label: "Maintenance" },
  { value: "transport", label: "Transport / logistique" },
  { value: "marketing", label: "Marketing / communication" },
  { value: "travaux", label: "Travaux / aménagement" },
  { value: "equipement_industriel", label: "Équipements industriels" },
  { value: "matieres_premieres", label: "Matières premières" },
  { value: "emballage", label: "Emballage" },
  { value: "conseil", label: "Conseil" },
  { value: "autre", label: "Autre" },
] as const;

export const SUPPLIER_PURCHASE_TERMS_OPTIONS = [
  { value: "immediate", label: "Paiement immédiat" },
  { value: "on_receipt", label: "À réception de facture" },
  { value: "days_7", label: "7 jours" },
  { value: "days_15", label: "15 jours" },
  { value: "days_30", label: "30 jours" },
  { value: "days_45", label: "45 jours" },
  { value: "days_60", label: "60 jours" },
  { value: "days_30_end_of_month", label: "30 jours fin de mois" },
  { value: "days_60_end_of_month", label: "60 jours fin de mois" },
  { value: "on_order", label: "Paiement à la commande" },
  { value: "on_delivery", label: "Paiement à la livraison" },
  { value: "installments", label: "Paiement échelonné" },
  { value: "negotiated", label: "Conditions négociées" },
  { value: "other", label: "Autre" },
] as const;

export const SUPPLIER_RATING_OPTIONS = [
  { value: "", label: "Non évalué" },
  { value: "5", label: "Excellent" },
  { value: "4", label: "Bon" },
  { value: "3", label: "Moyen" },
  { value: "2", label: "À surveiller" },
  { value: "1", label: "Bloqué" },
] as const;

export const SUPPLIER_PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Espèces" },
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "check", label: "Chèque" },
  { value: "certified_check", label: "Chèque certifié" },
  { value: "bill_of_exchange", label: "Effet / Lettre de change" },
  { value: "card", label: "Carte bancaire" },
  { value: "direct_debit", label: "Prélèvement automatique" },
  { value: "bank_deposit", label: "Dépôt bancaire" },
  { value: "cash_on_delivery", label: "Paiement à la livraison" },
  { value: "installments", label: "Paiement échelonné" },
  { value: "mixed", label: "Mixte" },
  { value: "other", label: "Autre" },
] as const;

export function getSupplierPurchaseTermsLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const found = SUPPLIER_PURCHASE_TERMS_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}

export function getSupplierRatingLabel(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return "Non évalué";
  const str = String(value);
  const found = SUPPLIER_RATING_OPTIONS.find((o) => o.value === str);
  return found?.label ?? str;
}

export function getSupplierPaymentMethodLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const found = SUPPLIER_PAYMENT_METHOD_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}

export function getSupplierCategoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const found = SUPPLIER_CATEGORY_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}

export function formatSupplierCategories(raw: string | null | undefined): string {
  if (!raw) return "-";
  return raw.split(",").map((s) => getSupplierCategoryLabel(s.trim()) ?? s.trim()).filter(Boolean).join(", ");
}
