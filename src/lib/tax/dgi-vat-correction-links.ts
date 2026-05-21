import type { DgiVatValidationIssue } from "@/lib/tax/dgi-vat-types";

export function buildDgiVatCorrectionLink(issue: DgiVatValidationIssue): {
  href: string | null;
  label: string;
} {
  const { source, sourceId, thirdPartyId, documentNumber } = issue;

  // Organization settings
  if (source === "organization") {
    return { href: "/parametres/entreprise", label: "Corriger l'entreprise" };
  }

  // Third party (customer / supplier / generic)
  if ((source === "customer" || source === "supplier" || source === "third_party") && thirdPartyId) {
    return { href: `/tiers/${thirdPartyId}/edit`, label: "Corriger le tiers" };
  }

  // Customer invoice
  if ((source === "customer_invoice" || source === "sales") && sourceId) {
    return { href: `/facturation/factures/${sourceId}`, label: "Ouvrir la facture client" };
  }

  // Supplier invoice / purchase document
  if ((source === "supplier_invoice" || source === "purchase" || source === "purchase_document") && sourceId) {
    return { href: `/achats/factures/${sourceId}`, label: "Ouvrir la facture fournisseur" };
  }

  // Accounting entry
  if (source === "accounting_entry" && sourceId) {
    return { href: `/comptabilite/ecritures/${sourceId}`, label: "Ouvrir l'écriture" };
  }

  // Tax rate
  if (source === "tax_rate") {
    return { href: "/articles/tva", label: "Vérifier les taux TVA" };
  }

  // Payment
  if (source === "payment" || source === "customer_payment" || source === "supplier_payment") {
    if (sourceId) {
      return { href: `/achats/factures/${sourceId}`, label: "Corriger paiement / facture" };
    }
  }

  // Fallback: if we have a document number but no link, show text only
  if (documentNumber) {
    return { href: null, label: `Pièce ${documentNumber}` };
  }

  return { href: null, label: "Non actionnable" };
}

export function appendReturnTo(href: string | null, returnTo: string): string | null {
  if (!href) return null;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
