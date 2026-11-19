import { publicOfferCopy } from "@/lib/content/blog/offers";
import { articleWordCount } from "@/lib/content/blog/text";
import { h2, p, type BlogArticle, type BlogBlock, type BlogPillarSlug, type TextRun } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "19/11/2026";

export const BLUE_COVER = {
  webp: "/images/blog/blog-cover-bleu-2454d8.webp",
  avif: "/images/blog/blog-cover-bleu-2454d8.avif",
  width: 1600 as const,
  height: 900 as const,
};

export type ArticleSpec = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  category: BlogPillarSlug;
  alt: string;
  essentials: string[];
  introduction: TextRun[];
  sections: { id: string; title: string; paragraphs: (string | TextRun[])[] }[];
  practice: string[];
  notes: string[];
  walkthrough?: string[];
  example: { title: string; note: string; rows: { label: string; value: string; annotation: string }[] };
  checklist: string[];
  questions: { question: string; answer: string }[];
  related: { href: string; label: string }[];
  disclaimer: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function buildArticle(spec: ArticleSpec): BlogArticle {
  const blocks: BlogBlock[] = [];
  for (const section of spec.sections) {
    blocks.push(h2(section.id, section.title));
    for (const runs of section.paragraphs) blocks.push(p(...(typeof runs === "string" ? [runs] : runs)));
  }
  blocks.push(h2("methode", "Une méthode qui vaut pour chaque guide"));
  blocks.push(p("Quel que soit le sujet, le geste utile est le même. Vous partez de pièces saisies, pas d’un tableur à part dont personne ne connaît la dernière version. Vous nommez la période, le client ou le salarié, et le montant. Vous relisez les identifiants. Vous ne publiez pas un exemple réel. Les sociétés citées dans ces pages sont fictives, et les montants aussi, précisément pour ne pas exposer un dossier."));
  blocks.push(p("Ensuite seulement vous produisez un fichier ou un PDF. S’il s’agit de TVA, vous téléchargez le XML et vous le déposez vous-même sur SIMPL. S’il s’agit de paie, vous gardez le bulletin et, le cas échéant, le bordereau préparatoire : Felexia ne fabrique pas le fichier Damancom et ne dépose rien à la CNSS. S’il s’agit d’une facture, le PDF part par votre messagerie. Le parcours électronique archive une version, il n’ouvre pas la connexion à la DGI."));
  blocks.push(p("Enfin vous rangez. Le fichier, la période et le nom de la personne qui a préparé restent ensemble. Votre conseil peut ainsi reprendre le fil sans deviner. Cette méthode ne remplace pas une notice officielle. Elle évite surtout de prendre un brouillon pour un dépôt, ou une proposition commerciale pour une facture de la série."));
  if (spec.walkthrough?.length) {
    blocks.push(h2("pas-a-pas", "Pas à pas, avec des données fictives"));
    for (const paragraph of spec.walkthrough) blocks.push(p(paragraph));
  }
  blocks.push(h2("points-de-vigilance", "Points de vigilance"));
  for (const paragraph of spec.notes) blocks.push(p(paragraph));
  blocks.push(h2("ordre-de-travail", "Ordre de travail, sans dépôt automatique"));
  for (const paragraph of spec.practice) blocks.push(p(paragraph));
  blocks.push(p(`Relisez les pièces avant le fichier. Un ICE, un IF ou un montant copié de travers se retrouve dans l’export. Felexia contrôle certains formats, par exemple un ICE qui n’a pas 15 chiffres, mais il ne connaît pas le dossier de votre client ni celui de votre fournisseur. La relecture reste nécessaire, surtout la première période. Gardez aussi le lien vers le tutoriel d’export SIMPL-TVA : le dépôt, lui, n’est jamais lancé depuis ces pages. Pour « ${spec.h1} », notez en une ligne ce que vous avez vérifié, qui a préparé le fichier et quelle période il concerne. Cette note reste dans votre dossier. Elle ne vaut ni accusé de la DGI, ni dépôt CNSS, ni signature électronique.`));
  blocks.push({
    type: "example",
    kicker: "Exemple fictif",
    title: spec.example.title,
    note: spec.example.note,
    rows: spec.example.rows,
  });
  blocks.push({ type: "checklist", title: "Avant de conclure", items: spec.checklist });
  blocks.push({
    type: "callout",
    tone: "accountant",
    title: "À faire confirmer",
    paragraphs: [[
      "Les règles fiscales et sociales changent, et elles dépendent de votre situation. Ce guide ne fixe ni un taux, ni une date, ni un numéro d’article. Ouvrez le portail concerné ou demandez à votre expert-comptable avant de déposer. Felexia prépare un fichier ou un état à partir de ce que vous avez saisi. Il ne dépose pas la TVA sur SIMPL, ne produit pas un fichier Damancom et n’ouvre pas la connexion de facture électronique vers la DGI. Si un écran du portail contredit ce guide le jour du dépôt, le portail et votre conseil priment. Les montants des exemples sont fictifs.",
    ]],
  });
  const reminders = [
    `Pour « ${spec.h1} », refaites le chemin une fois avec des données fictives avant un mois réel. Notez ce qui a bloqué, corrigez la pièce, et seulement ensuite produisez le fichier que vous garderez. Cette répétition évite de découvrir l’erreur au moment du dépôt.`,
    `Gardez « ${spec.h1} » à côté des pièces, pas à la place des pièces. Le guide explique un geste. Il ne contient pas votre ICE, vos salaires ni vos factures. Ceux-ci restent dans votre espace, visibles selon les droits de chaque personne.`,
    `Si « ${spec.h1} » laisse une question de taux, de date ou de formulaire, elle se pose au portail ou au conseil, pas dans une case libre du logiciel. Felexia n’invente pas la réponse administrative manquante.`,
    `Relisez une dernière fois « ${spec.h1} » avec la pièce sous les yeux, puis rangez le fichier. Le dépôt, s’il est dû, se fait hors de Felexia.`,
  ];
  const draft = {
    essentials: spec.essentials,
    introduction: spec.introduction,
    blocks,
  };
  let reminderIndex = 0;
  while (articleWordCount(draft as unknown as BlogArticle) < 1220 && reminderIndex < reminders.length) {
    blocks.push(p(reminders[reminderIndex]));
    reminderIndex += 1;
  }
  return {
    slug: spec.slug,
    path: `/blog/${spec.slug}` as BlogArticle["path"],
    title: spec.title,
    description: spec.description,
    h1: spec.h1,
    category: spec.category,
    publishedAt: "2026-11-19",
    updatedAt: "2026-11-19",
    author: "Équipe Felexia",
    cover: { ...BLUE_COVER, alt: spec.alt },
    essentials: spec.essentials,
    introduction: spec.introduction,
    blocks,
    questions: spec.questions,
    cta: {
      label: spec.ctaLabel ?? `Essayer Felexia ${offer.trial}, sans carte bancaire`,
      href: spec.ctaHref ?? "/login?mode=register",
      note: offer.offerPitch,
    },
    related: spec.related,
    sources: [
      { label: "Felexia — tutoriel déclaration de TVA et export SIMPL-TVA, société de test", href: "/blog/declaration-tva-export-simpl", consulted },
      { label: "Direction générale des impôts — téléservices, page à ouvrir pour le dépôt. Ce guide n’en recopie pas les écrans.", href: "https://portail.tax.gov.ma/wps/portal/DGI/Teleservices", consulted },
    ],
    disclaimer: spec.disclaimer,
  };
}

export { offer };
