import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { PUBLIC_SITE_ORIGIN, isPublicSitePath } from "@/lib/public-site";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

/** SEO stays on the public www host; OAuth keeps its independent URL contract. */
export const SEO_SITE_URL = PUBLIC_SITE_ORIGIN;
export const SEO_CONTENT_UPDATED_AT = "2026-11-03";
export const SEO_DEFAULT_TITLE = "Logiciel de gestion PME au Maroc et ERP | Felexia";
export const SEO_DEFAULT_DESCRIPTION =
  "Logiciel de gestion pour les PME au Maroc : facturation, achats et trésorerie avec ESSENTIEL. PRO est l’ERP complet, stock compris, disponible uniquement sur devis.";
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
  alt: "FelexiaERP, logiciel de gestion et ERP pour les PME au Maroc",
};

/** Search Console meta tag. Empty or invalid values stay disabled: no code is invented. */
export function readGoogleSiteVerification(): string | null {
  const value = process.env.GOOGLE_SITE_VERIFICATION?.trim() || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || "";
  return /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : null;
}

const googleSiteVerification = readGoogleSiteVerification();

/** Only allowlisted public routes may opt into indexing. */
export function createPublicMetadata({ title, description, path, image, article }: {
  title: string;
  description: string;
  path: string;
  image?: { path: string; width: number; height: number; alt: string };
  article?: { publishedAt: string; updatedAt: string; author: string };
}): Metadata {
  if (!isPublicSitePath(path)) throw new Error("SEO public metadata requires an allowlisted public route.");
  const url = canonicalUrl(path);
  const socialImage = image
    ? { url: canonicalUrl(image.path), width: image.width, height: image.height, alt: image.alt }
    : shareImage;
  const openGraph = article
    ? {
        type: "article" as const,
        locale: "fr_MA" as const,
        siteName: BRAND.name,
        title,
        description,
        url,
        images: [socialImage],
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
        authors: [article.author],
      }
    : {
        type: "website" as const,
        locale: "fr_MA" as const,
        siteName: BRAND.name,
        title,
        description,
        url,
        images: [socialImage],
      };
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: PUBLIC_ROBOTS,
    openGraph,
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
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
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
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
        description: "Logiciel de gestion et ERP pour les PME au Maroc.",
        logo: { "@type": "ImageObject", url: canonicalUrl(BRAND.logoMark), width: 512, height: 512 },
        email: LEGAL_CONFIG.supportEmail,
        areaServed: { "@type": "Country", name: "Maroc" },
        // TODO(owner): add the official Facebook profile URL when it exists. Do not invent it.
        sameAs: ["https://www.instagram.com/felexiaerp/", "https://www.linkedin.com/company/felexiaerp/"],
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

export function getFaqPageStructuredData(questions: readonly { question: string; answer: string }[], path: string) {
  const url = canonicalUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    url,
    inLanguage: "fr-MA",
    isPartOf: { "@id": `${canonicalUrl("/")}#website` },
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function getBlogPostingStructuredData(article: {
  h1: string;
  description: string;
  path: string;
  publishedAt: string;
  updatedAt?: string;
  author?: string;
  cover?: { webp: string; alt: string; width: number; height: number };
}) {
  const url = canonicalUrl(article.path);
  const home = canonicalUrl("/");
  const image = article.cover
    ? { "@type": "ImageObject", url: canonicalUrl(article.cover.webp), width: article.cover.width, height: article.cover.height, caption: article.cover.alt }
    : canonicalUrl(SEO_SHARE_IMAGE);
  return {
    "@context": "https://schema.org",
    "@type": ["BlogPosting", "Article"],
    "@id": `${url}#article`,
    headline: article.h1,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    inLanguage: "fr-MA",
    mainEntityOfPage: url,
    url,
    image,
    author: article.author
      ? { "@type": "Organization", name: article.author, url: home }
      : { "@id": `${home}#organization` },
    publisher: { "@id": `${home}#organization` },
  };
}

export function getBlogStructuredData(posts: readonly {
  h1: string;
  description: string;
  path: string;
  publishedAt?: string;
  updatedAt?: string;
  cover?: { webp: string };
}[]) {
  const url = canonicalUrl("/blog");
  const home = canonicalUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${url}#blog`,
    name: "Guides FelexiaERP",
    description: "Guides sur le logiciel de gestion, la facturation et le stock pour les PME au Maroc.",
    url,
    inLanguage: "fr-MA",
    publisher: { "@id": `${home}#organization` },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.h1,
      description: post.description,
      url: canonicalUrl(post.path),
      ...(post.publishedAt ? { datePublished: post.publishedAt, dateModified: post.updatedAt ?? post.publishedAt } : {}),
      ...(post.cover ? { image: canonicalUrl(post.cover.webp) } : {}),
    })),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
