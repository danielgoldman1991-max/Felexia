import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

export type PublicFaqItem = { question: string; answer: string };

const essential = getPlanDefinition("essentiel");
const price = essential.monthlyPrice.toLocaleString("fr-FR");
const yearly = essential.yearlyPrice.toLocaleString("fr-FR");

/** Visible homepage FAQ. Structured data must reuse these exact strings. */
export const HOME_FAQS: readonly PublicFaqItem[] = [
  {
    question: "Que comprend l’offre Essentiel ?",
    answer:
      "ESSENTIEL couvre la facturation (factures, PDF, et facturation électronique PDF/XML avec archivage), les règlements et les journaux comptables, jusqu’à 3 utilisateurs. Les devis, les commandes, le stock et le reste de l’ERP sont dans PRO.",
  },
  {
    question: "Comment fonctionne l’essai gratuit ?",
    answer: `Créez votre compte et votre espace entreprise pour découvrir l’offre Essentiel pendant ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire. Retrouvez ci-dessous les tarifs mensuels et annuels ESSENTIEL et l’offre PRO sur devis.`,
  },
  {
    question: "Puis-je personnaliser mes factures ?",
    answer:
      "Oui. Ajoutez votre logo, les coordonnées et l’ICE de votre entreprise. Configurez vos informations et votre numérotation pour retrouver votre identité sur les factures PDF.",
  },
  {
    question: "Felexia fonctionne-t-il sur mobile ?",
    answer:
      "Oui. Votre espace est accessible dans votre navigateur sur ordinateur, tablette et téléphone. Vous pouvez retrouver vos factures, vos règlements et votre trésorerie depuis ces appareils.",
  },
  {
    question: "Que change l’offre PRO ?",
    answer:
      "PRO reprend ESSENTIEL et ajoute les devis, les prospects, les commandes, les livraisons, les achats et réceptions, le stock, la comptabilité étendue, la préparation TVA, les prévisions de trésorerie et les RH, jusqu’à 25 utilisateurs. Le passage à PRO est une raison de sortir du seul cycle facture-règlement-journal.",
  },
  {
    question: "Comment obtenir une proposition PRO ?",
    answer:
      "PRO est proposé uniquement sur devis. Contactez notre équipe pour présenter votre activité et vos besoins ; nous vous préparons une proposition. L’essai gratuit concerne ESSENTIEL. Votre entreprise conserve son espace et ses données lors de l’activation de PRO.",
  },
  {
    question: "La facturation électronique est-elle incluse ?",
    answer:
      "Oui, dans ESSENTIEL comme dans PRO. À partir de vos factures et avoirs clients validés, générez les documents PDF/XML, puis émettez et archivez la version retenue. Votre administrateur active cette fonctionnalité depuis Ventes → Facturation électronique → Configuration.",
  },
  {
    question: "Les factures sont-elles transmises à la DGI ?",
    answer:
      "Le parcours actuel couvre les documents PDF/XML et leur archivage. La connexion officielle à la DGI et la signature qualifiée ne sont pas activées. Le XML généré ne constitue pas une acceptation fiscale.",
  },
  {
    question: "Que se passe-t-il après les 15 jours ?",
    answer:
      "À la fin de l’essai, l’espace passe en consultation : les données restent lisibles et les exports déjà prévus restent disponibles. Créer ou modifier des opérations demande un abonnement ESSENTIEL actif. Le tarif publié ensuite est celui affiché sur la page Tarifs.",
  },
  {
    question: "Où sont stockées mes données ?",
    answer:
      "Le site est servi par Vercel. Les données de l’entreprise sont dans la base PostgreSQL Supabase de production, en région eu-west-1. L’accès passe par le compte, le rôle et des règles par entreprise. Les communications sont chiffrées en transit. La fréquence, la durée de conservation et la restauration à un instant des sauvegardes ne sont pas publiées.",
  },
  {
    question: "Puis-je exporter mes factures et partir ?",
    answer:
      "Oui. Chaque facture se télécharge en PDF, et plusieurs listes s’exportent en CSV. Le propriétaire ou l’administrateur trouve aussi, dans Paramètres, « Exporter les données » : une archive ZIP de son entreprise seulement (tiers, factures et lignes, règlements, articles, écritures, et salariés si l’offre est PRO). Un FEC préparatoire reste disponible en comptabilité : ce n’est pas une transmission officielle.",
  },
  {
    question: "Puis-je importer mes clients depuis Excel ?",
    answer:
      "Oui, pour les clients et les fournisseurs. Dans Tiers, « Importer » propose un modèle CSV, que l’on ouvre dans Excel avec le séparateur point-virgule. L’aperçu refuse un ICE qui n’a pas 15 chiffres et un doublon de nom ou d’ICE. Rien n’est enregistré avant la confirmation, et les lignes sont ajoutées seulement à l’entreprise ouverte. Un résumé indique le nombre de contacts créés. L’import des salariés reste à part, dans le module RH de PRO.",
  },
  {
    question: "Qui m’aide si je bloque ?",
    answer:
      "Écrivez sur WhatsApp au +212 6 14 50 50 90, ou à contact@felexia.pro. Aucun horaire de réponse ni délai garanti n’est publié.",
  },
];

/** Visible pricing FAQ. Amounts come from the public plan catalogue, not from a second price list. */
export const PRICING_FAQS: readonly PublicFaqItem[] = [
  {
    question: `Que comprend ESSENTIEL à ${price} HT MAD par mois ?`,
    answer: `La facturation, les règlements et les journaux comptables, jusqu’à ${essential.limits.users} utilisateurs, ${essential.limits.commercialDocumentsPerMonth?.toLocaleString("fr-FR")} documents commerciaux par mois et ${essential.limits.storageMb / 1024} Go de stockage. La facturation annuelle est de ${yearly} HT MAD, soit douze mois sans remise. Les devis ne sont pas dans ESSENTIEL. La génération PDF/XML et l’archivage documentaire sont inclus.`,
  },
  {
    question: "Faut-il une carte bancaire pour l’essai ?",
    answer: `Non. L’essai ESSENTIEL de ${DEFAULT_TRIAL_DURATION_LABEL} est gratuit et ne demande pas de carte bancaire. Créez votre compte, puis confirmez votre entreprise pour accéder à votre espace.`,
  },
  {
    question: "Pourquoi l’ERP PRO est-il sur devis ?",
    answer: "PRO dépend des métiers et des parcours à mettre en place : devis, commandes, livraisons, stock, comptabilité ou dossiers du personnel. Aucun prix PRO ni achat direct en ligne n’est proposé. L’essai public gratuit concerne uniquement ESSENTIEL.",
  },
  {
    question: "Le logiciel de facturation électronique est-il dans le tarif ?",
    answer:
      "Oui, dans ESSENTIEL comme dans PRO. Le parcours couvre le PDF, le XML, l’émission et l’archivage après activation par l’administrateur. La connexion officielle à la DGI et la signature qualifiée ne sont pas activées.",
  },
];
