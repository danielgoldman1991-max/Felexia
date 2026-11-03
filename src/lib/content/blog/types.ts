import type { PublicSitePath } from "@/lib/public-site";

/** Seven editorial pillars. Empty ones stay visible so the taxonomy is stable. */
export const BLOG_PILLARS = [
  { slug: "facturation", label: "Facturation" },
  { slug: "facture-electronique", label: "Facture électronique" },
  { slug: "tva-fiscalite", label: "TVA et fiscalité" },
  { slug: "stock-achats", label: "Stock et achats" },
  { slug: "tresorerie", label: "Trésorerie et recouvrement" },
  { slug: "choix-logiciel", label: "Choix du logiciel" },
  { slug: "profils-secteurs", label: "Profils et secteurs" },
] as const;

export type BlogPillarSlug = (typeof BLOG_PILLARS)[number]["slug"];

export type TextRun = string | { href: string; label: string };

export type BlogBlock =
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; id: string; text: string }
  | { type: "p"; runs: TextRun[] }
  | { type: "ul"; items: TextRun[][] }
  | { type: "callout"; tone: "accountant" | "product" | "note"; title: string; paragraphs?: TextRun[][]; items?: readonly string[] }
  | { type: "table"; caption: string; columns: readonly string[]; rows: readonly (readonly string[])[] }
  | { type: "checklist"; title: string; items: readonly string[] }
  | { type: "example"; kicker: string; title: string; note: string; rows: readonly { label: string; value: string; annotation: string }[] };

export type BlogArticle = {
  slug: string;
  path: PublicSitePath;
  title: string;
  description: string;
  h1: string;
  category: BlogPillarSlug;
  publishedAt: string;
  updatedAt: string;
  author: string;
  featured?: boolean;
  cover: { webp: string; avif: string; alt: string; width: 1600; height: 900 };
  essentials: readonly string[];
  introduction: TextRun[];
  blocks: readonly BlogBlock[];
  questions: readonly { question: string; answer: string }[];
  cta: { label: string; href: string; note: string };
  related: readonly { href: string; label: string }[];
  sources: readonly { label: string; href: string; consulted: string }[];
  disclaimer: string;
};

export const h2 = (id: string, text: string): BlogBlock => ({ type: "h2", id, text });
export const h3 = (id: string, text: string): BlogBlock => ({ type: "h3", id, text });
export const p = (...runs: TextRun[]): BlogBlock => ({ type: "p", runs });
export const bullets = (items: TextRun[][]): BlogBlock => ({ type: "ul", items });
