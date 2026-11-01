import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { PUBLIC_SITE_ORIGIN, isPublicSitePath } from "@/lib/public-site";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

/** SEO stays on the public www host; OAuth keeps its independent URL contract. */
export const SEO_SITE_URL = PUBLIC_SITE_ORIGIN;
export const SEO_CONTENT_UPDATED_AT = "2026-11-01";
export const SEO_DEFAULT_TITLE = "Logiciel de gestion d’entreprise et ERP au Maroc | Felexia";
export const SEO_DEFAULT_DESCRIPTION =
  "Gérez ventes, achats, factures et trésorerie avec ESSENTIEL. Découvrez PRO, l’ERP complet sur devis pour votre entreprise au Maroc.";
export const SEO_SHARE_IMAGE = "/opengraph-image";

export function canonicalUrl(path = "/"): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\?#]/.test(path)) {
    throw new Error("SEO canonical requires an internal pathname without query or fragment.");
  }
  return new URL(path.replace(/\/+$/, "") || "/", SEO_SITE_URL).toString();
}

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  noarchive: true,
  nocache: true,
  nosnippet: true,
  googleBot: { index: false, follow: false, noimageindex: true, nosnippet: true },
};

const PUBLIC_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

const shareImage = {
  url: canonicalUrl(SEO_SHARE_IMAGE),
  width: 1200,
  height: 630,
  alt: "FelexiaERP — ESSENTIEL au quotidien, PRO sur devis",
};

/** Only the seven explicit marketing/legal routes may opt into public indexing. */
export function createPublicMetadata({ title, description, path }: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  if (!isPublicSitePath(path)) throw new Error("SEO public metadata requires an allowlisted public route.");
  const url = canonicalUrl(path);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: PUBLIC_ROBOTS,
    openGraph: {
      type: "website",
      locale: "fr_MA",
      siteName: BRAND.name,
      title,
      description,
      url,
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title, description, images: [shareImage] },
  };
}

/** New private pages inherit noindex unless they explicitly use the public helper. */
export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SEO_SITE_URL),
  applicationName: BRAND.name,
  title: { default: SEO_DEFAULT_TITLE, template: "%s | Felexia" },
  description: SEO_DEFAULT_DESCRIPTION,
  robots: PRIVATE_ROBOTS,
  icons: {
    icon: [
      { url: BRAND.favicon },
      { url: BRAND.icon32, sizes: "32x32", type: "image/png" },
      { url: BRAND.icon48, sizes: "48x48", type: "image/png" },
    ],
    shortcut: BRAND.favicon,
    apple: BRAND.appleTouchIcon,
  },
};

export function getSiteStructuredData() {
  const home = canonicalUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${home}#organization`,
        name: BRAND.name,
        alternateName: BRAND.shortName,
        url: home,
        logo: { "@type": "ImageObject", url: canonicalUrl(BRAND.logoMark), width: 512, height: 512 },
        email: LEGAL_CONFIG.supportEmail,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          telephone: "+212614505090",
          url: "https://wa.me/212614505090",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        name: BRAND.name,
        alternateName: BRAND.shortName,
        url: home,
        inLanguage: "fr-MA",
        publisher: { "@id": `${home}#organization` },
      },
    ],
  };
}

/** Describe real public offers only; PRO deliberately has no invented numeric price. */
export function getSoftwareApplicationStructuredData() {
  const essential = getPlanDefinition("essentiel");
  const home = canonicalUrl("/");
  const trial = `Essai ESSENTIEL de ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire.`;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${home}#software`,
    name: BRAND.name,
    url: home,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "fr",
    description: `${SEO_DEFAULT_DESCRIPTION} ${trial} PRO est disponible uniquement sur devis.`,
    publisher: { "@id": `${home}#organization` },
    featureList: [
      "ESSENTIEL : ventes, achats, clients, fournisseurs, factures et règlements",
      "ESSENTIEL : trésorerie et journaux comptables",
      "Facturation électronique PDF/XML et archivage inclus",
      "PRO sur devis : gestion commerciale étendue, stock, comptabilité et RH préparatoires",
    ],
    offers: [
      { name: "ESSENTIEL — mensuel", amount: essential.monthlyPrice, duration: "P1M", cadence: "par mois" },
      { name: "ESSENTIEL — annuel", amount: essential.yearlyPrice, duration: "P1Y", cadence: "par an" },
    ].map(({ name, amount, duration, cadence }) => ({
      "@type": "Offer",
      name,
      url: canonicalUrl("/pricing"),
      price: amount,
      priceCurrency: essential.currency,
      description: `${amount} HT MAD ${cadence}. ${trial}`,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: amount,
        priceCurrency: essential.currency,
        valueAddedTaxIncluded: false,
        billingDuration: duration,
      },
    })),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
