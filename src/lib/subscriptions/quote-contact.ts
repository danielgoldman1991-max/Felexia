import { LEGAL_CONFIG } from "@/lib/legal/legal-config";

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
