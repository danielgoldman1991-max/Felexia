import type { PublicSitePath } from "@/lib/public-site";
import type { PublicFaqItem } from "@/lib/content/public-faq";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

export type GuideSection = {
  heading: string;
  paragraphs: readonly string[];
  points?: readonly string[];
};

export type PublicGuide = {
  kind: "landing" | "article";
  slug?: string;
  path: PublicSitePath;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  introduction: string;
  publishedAt: "2026-11-03";
  sections: readonly GuideSection[];
  questions: readonly PublicFaqItem[];
  cta: { label: string; href: string; note: string };
  related: readonly { href: string; label: string }[];
};

const essential = getPlanDefinition("essentiel");
const pro = getPlanDefinition("premium");
const money = (value: number) => value.toLocaleString("fr-FR");
const monthly = money(essential.monthlyPrice);
const yearly = money(essential.yearlyPrice);
const users = essential.limits.users;
const documents = essential.limits.commercialDocumentsPerMonth?.toLocaleString("fr-FR");
const storage = essential.limits.storageMb / 1024;
const proUsers = pro.limits.users;
const proStorage = pro.limits.storageMb / 1024;

const billingFacts = `ESSENTIEL est affiché à ${monthly} HT MAD par mois, ou ${yearly} HT MAD par an sans remise. L’essai dure ${DEFAULT_TRIAL_DURATION_LABEL} et ne demande pas de carte bancaire. PRO, l’ERP complet, est proposé uniquement sur devis.`;

export const LANDING_GUIDES: readonly PublicGuide[] = [
  {
    kind: "landing",
    path: "/logiciel-facturation-maroc",
    title: "Logiciel de facturation au Maroc pour PME | Felexia",
    description: `Logiciel de facturation pour PME au Maroc : factures, avoirs, règlements et PDF avec votre logo et votre ICE. ESSENTIEL à ${monthly} HT MAD/mois, ${DEFAULT_TRIAL_DURATION_LABEL} d’essai sans carte.`,
    eyebrow: "Logiciel de facturation · Maroc",
    h1: "Logiciel de facturation pour les PME au Maroc",
    introduction: "FelexiaERP sert à établir les factures de vente, à suivre ce qui reste à encaisser et à retrouver les pièces d’un client au même endroit. L’offre ESSENTIEL couvre ce quotidien. L’ERP PRO, sur devis, prolonge le parcours avant et après la facture.",
    publishedAt: "2026-11-03",
    sections: [
      {
        heading: "Préparer une facture de vente",
        paragraphs: [
          "Choisissez le client, puis saisissez des articles du catalogue ou des lignes libres. Vous vérifiez les montants avant de finaliser le document. Les avoirs clients permettent de corriger une facture déjà émise sans perdre le lien avec la pièce d’origine.",
          "Les taux de TVA sont ceux que vous configurez pour vos opérations. Le document distingue le HT, la TVA et le TTC. Ce suivi aide la gestion ; il ne remplace pas la validation de votre conseil fiscal.",
        ],
        points: [
          "Clients et coordonnées de facturation",
          "Lignes d’articles ou lignes libres",
          "Avoirs et solde restant à encaisser",
          "Facture PDF avec votre logo, vos coordonnées et votre ICE",
        ],
      },
      {
        heading: "Rattacher le règlement à la facture",
        paragraphs: [
          "Un encaissement peut être total ou partiel. Il se rattache à la facture et au compte bancaire ou à la caisse concerné. Vous retrouvez ensuite le solde de la facture et le mouvement de trésorerie dans le même espace.",
          "Les factures d’achat, leurs avoirs et les paiements fournisseurs suivent la même logique, pour voir ce qui reste à payer.",
        ],
      },
      {
        heading: "Ce que comprend le tarif ESSENTIEL",
        paragraphs: [
          `${billingFacts} Le socle comprend 1 entreprise, jusqu’à ${users} utilisateurs, ${documents} documents commerciaux par mois et ${storage} Go de stockage.`,
          "Les journaux de vente, d’achat, de banque et de caisse restent consultables pour préparer vos échanges avec votre comptable. Les travaux comptables et fiscaux sont à vérifier avec les professionnels qui accompagnent l’entreprise.",
        ],
      },
      {
        heading: "Devis, livraisons et stock : le périmètre PRO",
        paragraphs: [
          "Si vous devez enchaîner devis, commandes, livraisons, retours, commandes fournisseurs ou mouvements de stock, ce périmètre est celui de PRO. Il se prépare sur devis, avec jusqu’à " + proUsers + " utilisateurs et " + proStorage + " Go de stockage. Aucun prix PRO n’est affiché en ligne.",
        ],
      },
      {
        // TODO(juridique): faire relire ce paragraphe. Dire uniquement que le parcours documentaire est prêt ; ne jamais écrire « conforme DGI », « certifié » ou « transmis à l’administration ».
        heading: "Prêt pour la facture électronique",
        paragraphs: [
          "ESSENTIEL et PRO incluent la génération PDF/XML, l’émission et l’archivage des factures et avoirs clients validés, après activation par l’administrateur. Felexia est prêt pour la facture électronique au sens de ce parcours documentaire.",
          "La connexion officielle à la DGI et la signature qualifiée ne sont pas activées. Le XML généré ne constitue pas une acceptation fiscale.",
        ],
      },
    ],
    questions: [
      {
        question: "Puis-je facturer sans créer tout mon catalogue ?",
        answer: "Oui. Une facture de vente accepte des lignes libres, en plus des articles déjà enregistrés. Vous pouvez aussi créer les fiches de vos propres clients dans votre entreprise.",
      },
      {
        question: "Le logo et l’ICE apparaissent-ils sur le PDF ?",
        answer: "Oui, lorsqu’ils sont renseignés dans les paramètres de l’entreprise. Vérifiez-les avant d’envoyer le document à votre client.",
      },
      {
        question: `L’essai de ${DEFAULT_TRIAL_DURATION_LABEL} demande-t-il une carte ?`,
        answer: `Non. L’essai ESSENTIEL est gratuit et sans carte bancaire. Le tarif ensuite affiché est ${monthly} HT MAD par mois, ou ${yearly} HT MAD par an.`,
      },
      {
        question: "Les factures sont-elles envoyées à la DGI ?",
        answer: "Non. Le parcours couvre les documents PDF/XML et leur archivage. La connexion officielle à la DGI et la signature qualifiée ne sont pas activées.",
      },
    ],
    cta: {
      label: `Essayer ESSENTIEL ${DEFAULT_TRIAL_DURATION_LABEL}`,
      href: "/login?mode=register",
      note: "Sans carte bancaire. La création du compte ouvre ensuite la confirmation de votre entreprise.",
    },
    related: [
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
      { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
      { href: "/essentiel", label: "Détail de l’offre ESSENTIEL" },
      { href: "/pricing", label: "Tarifs ESSENTIEL et PRO" },
      { href: "/blog/choisir-entre-essentiel-et-pro", label: "Choisir entre ESSENTIEL et PRO" },
    ],
  },
  {
    kind: "landing",
    path: "/facturation-electronique-maroc",
    title: "Facturation électronique au Maroc | FelexiaERP",
    description: "Prêt pour la facture électronique : PDF, XML, émission et archivage des factures et avoirs clients. Inclus dans ESSENTIEL et PRO. Connexion DGI et signature qualifiée non activées.",
    eyebrow: "Facture électronique · Maroc",
    h1: "Prêt pour la facture électronique au Maroc",
    introduction: "Felexia prépare un parcours documentaire à partir de vos factures et avoirs clients déjà validés : fichier PDF, fichier XML, émission et archivage. Ce parcours est inclus dans ESSENTIEL et dans PRO. Il ne s’agit pas d’une connexion officielle à la DGI.",
    publishedAt: "2026-11-03",
    sections: [
      {
        heading: "Le parcours disponible dans votre espace",
        paragraphs: [
          "Depuis les factures et avoirs clients validés, vous générez les documents PDF et XML, puis vous émettez et archivez la version retenue. L’impression d’une pièce émise est servie depuis l’archive.",
          "Votre administrateur active la fonction depuis Ventes → Facturation électronique → Configuration. L’activation est propre à l’entreprise : Felexia ne l’ouvre pas en masse pour toutes les sociétés.",
        ],
        points: [
          "Génération PDF et XML",
          "Émission et archivage de la version retenue",
          "Téléchargements distincts",
          "Activation explicite par l’administrateur",
        ],
      },
      {
        // TODO(juridique): faire valider les limites ci-dessous avant toute campagne. Ne pas ajouter de promesse de conformité, de certification, de transmission ou de signature qualifiée.
        heading: "Ce que Felexia ne présente pas comme fait",
        paragraphs: [
          "Felexia est prêt pour la facture électronique au sens du parcours PDF/XML et de l’archivage. La connexion officielle à la DGI n’est pas activée. La signature qualifiée n’est pas activée. Le XML généré ne constitue pas une acceptation fiscale.",
          "Aucune déclaration n’est transmise automatiquement à l’administration. Les fonctions fiscales restent préparatoires et doivent être validées avec votre conseil.",
        ],
      },
      {
        heading: "Dans quelle offre le retrouver",
        paragraphs: [
          `${billingFacts} La facturation électronique documentaire est incluse dans les deux offres, y compris pendant l’essai ESSENTIEL une fois la fonction activée par l’administrateur.`,
          "Le logiciel de facturation du quotidien — clients, factures, avoirs et règlements — est décrit à part, ainsi que le périmètre stock de l’ERP PRO.",
        ],
      },
    ],
    questions: [
      {
        question: "Faut-il l’offre PRO pour la facture électronique ?",
        answer: "Non. La génération PDF/XML, l’émission et l’archivage sont inclus dans ESSENTIEL et dans PRO, après activation par l’administrateur de l’entreprise.",
      },
      {
        question: "Les fichiers sont-ils transmis à la DGI ?",
        answer: "Non. Felexia est prêt pour un parcours documentaire de facture électronique. La connexion officielle à la DGI et la signature qualifiée ne sont pas activées. Le XML généré ne constitue pas une acceptation fiscale.",
      },
      {
        question: "Qui active la fonction ?",
        answer: "L’administrateur de l’entreprise, depuis Ventes → Facturation électronique → Configuration. L’activation n’est pas faite automatiquement pour toutes les entreprises.",
      },
      {
        question: "Que devient une facture déjà émise ?",
        answer: "La version émise est archivée. Son impression est servie depuis cette archive, distincte des essais de génération.",
      },
    ],
    cta: {
      label: "Découvrir ESSENTIEL",
      href: "/essentiel",
      note: `Essai de ${DEFAULT_TRIAL_DURATION_LABEL} sans carte bancaire, puis ${monthly} HT MAD par mois.`,
    },
    related: [
      { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Où en est la facture électronique" },
      { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation au Maroc" },
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
      { href: "/pricing", label: "Voir les tarifs" },
      { href: "/blog/choisir-entre-essentiel-et-pro", label: "ESSENTIEL ou PRO" },
      { href: "/pro", label: "Périmètre de l’ERP PRO" },
    ],
  },
];

export const GUIDES: readonly PublicGuide[] = [...LANDING_GUIDES];

export function getGuide(path: PublicGuide["path"]): PublicGuide {
  const guide = GUIDES.find((item) => item.path === path);
  if (!guide) throw new Error("Missing public guide: " + path);
  return guide;
}
