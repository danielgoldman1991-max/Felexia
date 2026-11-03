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
      "ESSENTIEL est votre outil de gestion d’entreprise au quotidien : clients et fournisseurs, factures de vente et d’achat, règlements, comptes bancaires et caisses, trésorerie et journaux. La facturation électronique PDF/XML et l’archivage sont aussi inclus. Vous pouvez travailler jusqu’à 3 utilisateurs dans votre espace entreprise.",
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
      "PRO comprend tout ESSENTIEL et ouvre l’ERP complet : prospects, devis, commandes, livraisons, achats et réceptions, stock, comptabilité avec grand livre et balance, préparation TVA, prévisions de trésorerie et gestion RH. Vous pouvez travailler jusqu’à 25 utilisateurs. La TVA et la paie restent des fonctions préparatoires à valider avec vos conseils.",
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
];

/** Visible pricing FAQ. Amounts come from the public plan catalogue, not from a second price list. */
export const PRICING_FAQS: readonly PublicFaqItem[] = [
  {
    question: `Que comprend ESSENTIEL à ${price} HT MAD par mois ?`,
    answer: `Votre espace entreprise, la facturation, les achats, les règlements, la trésorerie et les journaux, jusqu’à ${essential.limits.users} utilisateurs, ${essential.limits.commercialDocumentsPerMonth?.toLocaleString("fr-FR")} documents commerciaux par mois et ${essential.limits.storageMb / 1024} Go de stockage. La facturation annuelle est de ${yearly} HT MAD, sans remise. La génération PDF/XML et l’archivage documentaire sont inclus.`,
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
