import { LEGAL_CONFIG } from "@/lib/legal/legal-config";

/** Public Felexia Team number already used by the floating WhatsApp button. */
export const FELEXIA_WHATSAPP_NUMBER = "212614505090";

export function getProWhatsAppHref(message = "Bonjour, je souhaite un devis Felexia PRO pour mon entreprise."): string {
  return `https://wa.me/${FELEXIA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Opens a draft in the user's mail app; no message is sent by Felexia. */
export function getProQuoteHref({ organizationName, organizationId }: { organizationName?: string; organizationId?: string } = {}): string {
  const email = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";
  const subject = "Felexia PRO — demande de devis";
  const body = [
    "Bonjour,",
    "",
    "Je souhaite recevoir un devis pour Felexia PRO, la version complète de l’ERP.",
    "",
    `Entreprise : ${organizationName ?? ""}`,
    ...(organizationId ? [`Identifiant entreprise : ${organizationId}`] : []),
    "Mes besoins : ",
    "",
    "Merci.",
  ].join("\n");
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
