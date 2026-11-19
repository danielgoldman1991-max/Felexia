import { ProductOfferPage, type ProductOfferContent } from "@/components/landing/ProductOfferPage";
import { createPublicMetadata } from "@/lib/seo";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

const plan = getPlanDefinition("essentiel");
const number = (value: number) => value.toLocaleString("fr-FR");
const documentLimit = plan.limits.commercialDocumentsPerMonth;
const documents = documentLimit === null ? "Sans plafond mensuel" : number(documentLimit) + " / mois";

export const metadata = createPublicMetadata({
  title: "Facturation et TVA au Maroc | Felexia ESSENTIEL",
  description: "Factures, règlements, journaux et déclaration TVA (export XML SIMPL-TVA) pour PME au Maroc. ESSENTIEL : " + number(plan.monthlyPrice) + " MAD HT/mois, essai 15 jours sans carte.",
  path: "/essentiel",
});

const content: ProductOfferContent = {
  name: "ESSENTIEL",
  eyebrow: "Logiciel de facturation pour TPE et PME au Maroc",
  title: "Logiciel de facturation et de déclaration TVA au Maroc",
  introduction: "Facturez, suivez vos règlements, tenez vos journaux et préparez votre déclaration de TVA dans un seul espace. L’essai dure " + DEFAULT_TRIAL_DURATION_LABEL + ", sans carte bancaire.",
  price: number(plan.monthlyPrice),
  priceUnit: "HT MAD / mois",
  priceDetail: number(plan.yearlyPrice) + " HT MAD / an avec une facturation annuelle, sans remise.",
  priceNote: DEFAULT_TRIAL_DURATION_LABEL + " d’essai gratuit, sans carte bancaire. Votre espace se crée après l’inscription et la confirmation des informations de votre entreprise.",
  facts: [
    { label: "Entreprise", value: String(plan.limits.organizations) },
    { label: "Utilisateurs", value: "Jusqu’à " + plan.limits.users },
    { label: "Documents commerciaux", value: documents },
    { label: "Stockage", value: number(plan.limits.storageMb / 1024) + " Go" },
  ],
  ctaLabel: "Commencer mes " + DEFAULT_TRIAL_DURATION_LABEL + " gratuits",
  ctaHref: "/login?mode=register",
  ctaNote: "Sans carte bancaire. Puis " + number(plan.monthlyPrice) + " HT MAD/mois pour votre entreprise, jusqu’à " + plan.limits.users + " utilisateurs.",
  featureHeading: "Factures, avoirs et règlements, avec les mentions ICE et IF",
  featureIntroduction: "L’offre s’adresse aux entreprises qui veulent structurer leur gestion courante, retrouver les documents d’un tiers et savoir ce qui reste à encaisser ou à payer.",
  features: [
    {
      title: "Facturer et suivre les encaissements",
      description: "Créez vos factures de vente avec vos articles ou des lignes libres, puis retrouvez les règlements associés et le solde à encaisser.",
      points: ["Clients et coordonnées de facturation", "Factures, avoirs et règlements clients", "Factures PDF avec votre logo, vos coordonnées et votre ICE"],
    },
    {
      title: "Organiser les achats fournisseurs",
      description: "Centralisez les factures d’achat, leurs avoirs et les paiements effectués pour garder une lecture claire de vos dettes fournisseurs.",
      points: ["Fiches fournisseurs et contacts", "Factures et avoirs fournisseurs", "Suivi des montants réglés et restant à payer"],
    },
    {
      title: "Suivre la banque et la caisse",
      description: "Retrouvez les encaissements, décaissements et mouvements de vos comptes. Reliez les règlements de vos factures à votre trésorerie.",
      points: ["Comptes bancaires et caisses", "Mouvements et transferts internes", "Suivi des soldes en MAD"],
    },
    {
      title: "Retrouver vos chiffres et vos documents",
      description: "Consultez les journaux et écritures de vos opérations, vos indicateurs de gestion et les exports disponibles pour préparer vos échanges avec votre comptable.",
      points: ["Journaux de vente, d’achat, de banque et de caisse", "Consultation des écritures et de leurs pièces liées", "Exports des données de gestion"],
    },
    {
      title: "Déclaration de TVA et relevé XML pour SIMPL-TVA",
      description: "Vous préparez la déclaration dans Felexia et vous exportez le XML du relevé de déductions. Vous le déposez vous-même sur SIMPL. Felexia n’envoie rien à la DGI.",
      points: ["Déclaration mensuelle ou trimestrielle", "Export XML SIMPL-TVA", "Contrôle avant le dépôt, qui reste le vôtre"],
    },
  ],
  workflowHeading: "Journaux comptables et suivi de trésorerie",
  workflowIntroduction: "Un parcours simple pour une prestation ou une vente de produits, sans multiplier les fichiers.",
  workflow: [
    { title: "Préparer la facture", description: "Choisissez le client, renseignez vos lignes et vérifiez les montants avant de finaliser votre document." },
    { title: "Enregistrer le règlement", description: "Rattachez le paiement à la facture et au compte bancaire ou à la caisse concernée, y compris pour un règlement partiel." },
    { title: "Suivre ce qui reste", description: "Retrouvez le solde de la facture, les mouvements de trésorerie et les écritures correspondantes dans votre espace." },
  ],
  electronicInvoicing: "ESSENTIEL inclut un parcours de facture électronique complet : génération PDF/XML, émission et archivage après activation par l’administrateur. Il n’attend plus que l’entrée en vigueur de la loi au Maroc. La connexion à la plateforme officielle n’est pas active aujourd’hui.",
  scopeHeading: "Ce qui reste dans PRO : devis, stock, paie et OCR",
  scopeIntroduction: "La facturation, les journaux et la déclaration de TVA sont déjà dans ESSENTIEL. PRO ajoute le cycle commercial, le stock, la paie et l’OCR interne, sur devis.",
  scope: [
    { title: "Une entreprise, une équipe restreinte", description: "L’offre comprend " + plan.limits.organizations + " entreprise et jusqu’à " + plan.limits.users + " utilisateurs. Les droits de chaque compte déterminent les actions accessibles." },
    { title: "Un essai pour vos nouveaux comptes", description: "Les nouveaux essais ESSENTIEL durent " + DEFAULT_TRIAL_DURATION_LABEL + ". À l’échéance, un abonnement actif est nécessaire pour poursuivre les créations et modifications ; vos données restent consultables selon vos droits." },
    { title: "Des chiffres à valider avec vos conseils", description: "Les journaux et exports facilitent le suivi de gestion. Les travaux comptables, fiscaux et sociaux restent à vérifier avec les professionnels qui accompagnent votre entreprise." },
  ],
  questions: [
    { question: "Que comprend le prix de " + number(plan.monthlyPrice) + " HT MAD par mois ?", answer: "Votre espace entreprise, les fonctions de gestion ESSENTIEL, jusqu’à " + plan.limits.users + " utilisateurs, vos documents commerciaux (" + documents + ") et " + number(plan.limits.storageMb / 1024) + " Go de stockage. La facturation annuelle est de " + number(plan.yearlyPrice) + " HT MAD, sans remise annuelle." },
    { question: "Faut-il une carte bancaire pour commencer ?", answer: "Non. L’essai ESSENTIEL de " + DEFAULT_TRIAL_DURATION_LABEL + " est gratuit et ne demande pas de carte bancaire. Créez votre compte, puis confirmez votre entreprise pour accéder à votre espace." },
    { question: "Puis-je travailler avec mes propres clients et fournisseurs ?", answer: "Oui. Vous pouvez créer leurs fiches et saisir vos documents dans votre propre entreprise. Vous pouvez aussi préparer des factures avec des lignes libres, sans devoir créer chaque prestation dans le catalogue d’articles." },
    { question: "Puis-je afficher mon logo et mon ICE sur mes factures ?", answer: "Oui. Renseignez le logo, les coordonnées et l’ICE de votre entreprise dans vos paramètres. Ces informations figurent sur les factures PDF ; vérifiez-les avant de transmettre vos documents à vos clients." },
    { question: "La déclaration de TVA est-elle incluse ?", answer: "Oui. ESSENTIEL prépare la déclaration et l’export XML SIMPL-TVA, comme PRO. Vous déposez le fichier vous-même sur SIMPL. Aucune déclaration n’est transmise automatiquement à la DGI." },
    { question: "Quand choisir PRO plutôt qu’ESSENTIEL ?", answer: "PRO convient si vous enchaînez devis, commandes, livraisons, stock, paie ou OCR interne. La déclaration de TVA est déjà dans ESSENTIEL. PRO est proposé sur devis." },
  ],
  nextHeading: "Tarif : " + number(plan.monthlyPrice) + " MAD HT/mois, essai de 15 jours",
  nextDescription: "Découvrez ESSENTIEL pendant " + DEFAULT_TRIAL_DURATION_LABEL + ", sans carte bancaire. Commencez par votre compte et les informations de votre entreprise.",
  related: { href: "/pro", label: "Découvrir PRO et son périmètre" },
  reading: [
    { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel déclaration TVA" },
    { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation au Maroc" },
  ],
};

export default function EssentialProductPage() {
  return <ProductOfferPage content={content} path="/essentiel" />;
}
