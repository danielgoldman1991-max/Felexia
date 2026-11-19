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
      "ESSENTIEL couvre la facturation (factures, avoirs, PDF, mentions ICE, IF et RC), les règlements, les journaux comptables, la déclaration de TVA et l’export XML SIMPL-TVA, ainsi que la facturation électronique PDF/XML avec archivage, jusqu’à 3 utilisateurs. Vous préparez la déclaration dans Felexia et vous la déposez vous-même sur SIMPL. Les devis, les commandes, le stock et la paie sont dans PRO.",
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
      "PRO reprend ESSENTIEL, déclaration de TVA comprise, et ajoute les devis, les prospects, les commandes, les livraisons, les achats et réceptions, le stock, la comptabilité étendue, les prévisions de trésorerie, l’OCR interne et les RH, jusqu’à 25 utilisateurs.",
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
      "Le parcours PDF/XML, l’émission et l’archivage sont complets. Aucune facture n’est transmise automatiquement : la connexion et la signature attendront l’entrée en vigueur de la loi sur la facture électronique au Maroc.",
  },
  {
    question: "La déclaration de TVA est-elle incluse dans ESSENTIEL ?",
    answer:
      "Oui, y compris l’export XML du relevé de déductions SIMPL-TVA, aussi dans PRO. Vous préparez la déclaration dans Felexia et vous la déposez vous-même sur SIMPL. Felexia n’envoie rien à la DGI.",
  },
  {
    question: "Felexia dépose-t-il la déclaration auprès de la DGI ?",
    answer:
      "Non. Aucune déclaration ni facture n’est transmise automatiquement à l’administration. Le dépôt sur SIMPL, comme les dépôts CNSS ou Damancom, reste à la charge de l’entreprise.",
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
    question: `Qu’est-ce qui est inclus à ${price} HT MAD par mois ?`,
    answer: `La facturation, les règlements, les journaux comptables et la déclaration de TVA avec l’export XML SIMPL-TVA, jusqu’à ${essential.limits.users} utilisateurs, ${essential.limits.commercialDocumentsPerMonth?.toLocaleString("fr-FR")} documents commerciaux par mois et ${essential.limits.storageMb / 1024} Go de stockage. La facturation annuelle est de ${yearly} HT MAD, soit douze mois sans remise. Vous déposez le fichier vous-même sur SIMPL. Les devis ne sont pas dans ESSENTIEL. Le parcours PDF/XML et l’archivage sont inclus.`,
  },
  {
    question: "L’essai est-il vraiment sans carte ?",
    answer: `Oui. L’essai ESSENTIEL de ${DEFAULT_TRIAL_DURATION_LABEL} est gratuit et ne demande pas de carte bancaire. Créez votre compte, puis confirmez votre entreprise pour accéder à votre espace.`,
  },
  {
    question: "Comment est proposé PRO ?",
    answer: "PRO dépend des métiers et des parcours à mettre en place : devis, commandes, livraisons, stock, comptabilité ou dossiers du personnel. Aucun prix PRO ni achat direct en ligne n’est proposé. L’essai public gratuit concerne uniquement ESSENTIEL.",
  },
  {
    question: "Le logiciel de facturation électronique est-il dans le tarif ?",
    answer:
      "Oui, dans ESSENTIEL comme dans PRO. Le parcours PDF, XML, émission et archivage est complet après activation par l’administrateur. La connexion à la plateforme officielle attend l’entrée en vigueur de la loi.",
  },
];
