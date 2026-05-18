export const DOCUMENT_TYPES = [
  { value: "quote", label: "Devis" },
  { value: "customer_order", label: "Commande client" },
  { value: "delivery_note", label: "Bon de livraison" },
  { value: "customer_invoice", label: "Facture client" },
  { value: "customer_credit_note", label: "Avoir client" },
  { value: "supplier_order", label: "Commande fournisseur" },
  { value: "supplier_receipt", label: "Bon de réception" },
  { value: "supplier_invoice", label: "Facture fournisseur" },
  { value: "supplier_credit_note", label: "Avoir fournisseur" },
  { value: "payment_receipt", label: "Reçu de paiement" },
  { value: "imported_document", label: "Document importé" },
  { value: "other", label: "Autre" },
] as const;

export const DOCUMENT_ORIGINS = [
  { value: "generated", label: "Généré par Felexia" },
  { value: "manual_import", label: "Importé manuellement" },
  { value: "exported", label: "Exporté" },
  { value: "archived", label: "Archivé" },
] as const;

export const DOCUMENT_STATUSES = [
  { value: "active", label: "Disponible" },
  { value: "available", label: "Disponible" },
  { value: "draft", label: "Brouillon" },
  { value: "validated", label: "Validé" },
  { value: "archived", label: "Archivé" },
  { value: "deleted", label: "Supprimé" },
] as const;

export const DOCUMENT_SOURCE_MODULES = [
  { value: "sales", label: "Ventes" },
  { value: "purchases", label: "Achats" },
  { value: "billing", label: "Facturation" },
  { value: "treasury", label: "Trésorerie" },
  { value: "accounting", label: "Comptabilité" },
  { value: "crm", label: "CRM" },
  { value: "stock", label: "Stock" },
  { value: "documents", label: "Documents" },
  { value: "settings", label: "Paramètres" },
  { value: "other", label: "Autre" },
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number]["value"];
export type DocumentOriginValue = (typeof DOCUMENT_ORIGINS)[number]["value"];
export type DocumentStatusValue = (typeof DOCUMENT_STATUSES)[number]["value"];
