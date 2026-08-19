/**
 * Configuration juridique centrale de FelexiaERP.
 *
 * FelexiaERP est un produit / service SaaS faisant partie intégrante de la
 * société éditrice : Felexia Conseils.
 *
 * Seules les informations réelles doivent être renseignées. Toute information
 * juridique non disponible doit rester `null` (ligne masquée sur les pages)
 * ou être configurée via les variables `NEXT_PUBLIC_LEGAL_*`.
 * Ne jamais inventer ICE, RC, IF, CNSS, adresse, forme juridique, capital,
 * numéro CNDP ou téléphone.
 */

export const LEGAL_CONFIG = {
  /** Société éditrice / exploitante du service. */
  companyName: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME ?? "Felexia Conseils",

  /** Produit / service. */
  productName: "FelexiaERP",

  /** Forme juridique (ex. "SARL") — null tant que non configurée. */
  legalForm: process.env.NEXT_PUBLIC_LEGAL_FORM ?? null,

  /** Capital social (ex. "1 000 000 MAD") — null tant que non configuré. */
  capital: process.env.NEXT_PUBLIC_LEGAL_CAPITAL ?? null,

  /** Registre de commerce — null tant que non configuré. */
  rc: process.env.NEXT_PUBLIC_LEGAL_RC ?? null,

  /** Identifiant Commun de l'Entreprise — null tant que non configuré. */
  ice: process.env.NEXT_PUBLIC_LEGAL_ICE ?? null,

  /** Identifiant Fiscal — null tant que non configuré. */
  ifNumber: process.env.NEXT_PUBLIC_LEGAL_IF ?? null,

  /** N° CNSS — null tant que non configuré. */
  cnss: process.env.NEXT_PUBLIC_LEGAL_CNSS ?? null,

  /** Siège social — null tant que non configuré. */
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? null,

  /** Ville du siège — null tant que non configurée. */
  city: process.env.NEXT_PUBLIC_LEGAL_CITY ?? null,

  country: "Maroc",

  /** Email légal / contact éditeur (réel : utilisé dans l'User-Agent API synta-iq). */
  legalEmail: process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? "contact@felexia.pro",

  /** Email support — placeholder à valider. */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@felexia.pro",

  /** Email vie privée / DPO — placeholder à valider. */
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@felexia.pro",

  /** Nom du responsable de publication — null tant que non configuré. */
  publisherName: process.env.NEXT_PUBLIC_LEGAL_PUBLISHER_NAME ?? null,

  /** Site officiel (prod : https://felexia.pro). */
  website: process.env.NEXT_PUBLIC_LEGAL_WEBSITE ?? "https://felexia.pro",

  /**
   * Hébergement réellement utilisé (vérifié dans le projet) :
   * - le service web est déployé sur l'infrastructure Vercel ;
   * - les bases de données / l'authentification reposent sur Supabase ;
   * - les paiements en ligne sont traités par Stripe ;
   * - l'authentification Google est proposée (Google OAuth).
   */
  hosting: {
    platform: "Vercel Inc.",
    dataServices: "Supabase",
    paymentProvider: "Stripe",
  },

  /** Date de dernière mise à jour des pages légales. */
  lastUpdated: "2026-08-11",
} as const;

/** Retourne la valeur si elle est renseignée, sinon `null` (ligne masquée). */
export function legalValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Rend une valeur juridique, ou un texte de remplacement si absente.
 * Utilisé uniquement lorsque la ligne doit rester visible (obligation légale).
 */
export function renderLegalValue(
  value: string | null | undefined,
  fallback = "Information à compléter",
): string {
  return legalValue(value) ?? fallback;
}
