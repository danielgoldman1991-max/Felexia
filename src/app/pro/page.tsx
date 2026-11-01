import { ProductOfferPage, type ProductOfferContent } from "@/components/landing/ProductOfferPage";
import { createPublicMetadata } from "@/lib/seo";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { getProQuoteHref } from "@/lib/subscriptions/quote-contact";

export const metadata = createPublicMetadata({
  title: "Felexia PRO — ERP complet au Maroc, sur devis",
  description: "Felexia PRO relie ventes, achats, stock, comptabilité et dossiers RH. Découvrez le périmètre de l’ERP au Maroc et préparez votre projet sur devis.",
  path: "/pro",
});

const plan = getPlanDefinition("premium");
const content: ProductOfferContent = {
  name: "PRO",
  eyebrow: "Felexia PRO · ERP au Maroc",
  title: "Reliez les métiers de votre entreprise avec PRO.",
  introduction: "Quand votre activité dépasse la facture, PRO rassemble votre gestion commerciale, vos achats, votre stock, votre comptabilité et vos dossiers RH. Tout ESSENTIEL est inclus ; le projet et les fonctions retenues sont précisés avec notre équipe.",
  price: "Sur devis",
  priceDetail: "Une proposition adaptée à votre entreprise et aux fonctions utiles à votre organisation.",
  priceNote: "La mise en place de PRO se prépare avec l’équipe Felexia. L’essai public gratuit concerne ESSENTIEL ; PRO ne s’achète pas directement en ligne.",
  facts: [
    { label: "Entreprise", value: String(plan.limits.organizations) },
    { label: "Utilisateurs", value: "Jusqu’à " + plan.limits.users },
    { label: "Socle ESSENTIEL", value: "Inclus" },
    { label: "Stockage", value: plan.limits.storageMb / 1024 + " Go" },
  ],
  ctaLabel: "Demander un devis PRO",
  ctaHref: getProQuoteHref(),
  featureHeading: "Une vue plus large, du devis aux chiffres de gestion.",
  featureIntroduction: "PRO prolonge la gestion quotidienne avec des parcours commerciaux et des outils de pilotage. Le devis précise les fonctions utilisables et le périmètre de votre mise en place.",
  features: [
    {
      title: "Relier les étapes de la vente",
      description: "Suivez le parcours commercial avant et après la facture, depuis le devis et la commande jusqu’à la livraison et au retour client.",
      points: ["Prospects, devis et commandes clients", "Conversion d’un devis en commande", "Livraisons et retours clients"],
    },
    {
      title: "Préparer les achats et les réceptions",
      description: "Complétez vos factures et règlements fournisseurs par la préparation des commandes et le suivi des marchandises reçues.",
      points: ["Commandes fournisseurs", "Réceptions liées aux commandes", "Suivi des documents d’achat"],
    },
    {
      title: "Suivre les emplacements et les mouvements",
      description: "Retrouvez les mouvements de vos articles et les quantités par emplacement pour rapprocher les opérations du terrain de votre gestion.",
      points: ["Emplacements de stockage", "Entrées, sorties et transferts", "Historique des mouvements de stock"],
    },
    {
      title: "Approfondir le suivi comptable et bancaire",
      description: "Consultez votre plan comptable, votre grand livre et votre balance. Préparez les rapprochements et les prévisions avec les données disponibles.",
      points: ["Plan comptable, grand livre et balance", "Rapprochement bancaire", "Prévisions de trésorerie selon vos hypothèses"],
    },
    {
      title: "Centraliser les dossiers du personnel",
      description: "Créez et modifiez les fiches des salariés, puis retrouvez les contrats enregistrés. Les autres consultations RH dépendent de leur périmètre disponible.",
      points: ["Création et modification des fiches salariés", "Création et liste des contrats", "Consultations RH et préparation de base de paie"],
    },
    {
      title: "Rassembler les pièces de gestion",
      description: "Retrouvez vos documents dans une bibliothèque liée à votre entreprise et préparez les éléments utiles aux travaux fiscaux avec vos conseils.",
      points: ["Bibliothèque documentaire et import de fichiers", "Consultation et téléchargement des pièces", "Préparation des déclarations TVA et exports"],
    },
  ],
  workflowHeading: "Un même fil entre la vente et le terrain.",
  workflowIntroduction: "Pour une vente de marchandises, chaque étape apporte une information utile à l’équipe suivante.",
  workflow: [
    { title: "Du devis à la commande", description: "Préparez votre proposition commerciale et convertissez le devis retenu en commande client pour garder le lien entre les documents." },
    { title: "De la commande à la livraison", description: "Retrouvez les articles et les quantités à livrer, puis suivez les livraisons et les retours dans votre cycle de vente." },
    { title: "De l’opération au pilotage", description: "Rassemblez les mouvements, les factures, les règlements et les écritures pour suivre votre activité et échanger avec vos conseils." },
  ],
  electronicInvoicing: "Comme dans ESSENTIEL, la génération PDF/XML, l’émission et l’archivage documentaire sont inclus après activation. Cette compatibilité ne signifie pas une certification DGI, une transmission fiscale automatique ou une signature qualifiée.",
  scopeHeading: "Un périmètre clair avant votre mise en place.",
  scopeIntroduction: "Un ERP couvre plusieurs métiers. Nous distinguons les opérations disponibles, les outils préparatoires et les fonctions qui restent à venir pour construire un projet adapté à votre activité.",
  scope: [
    { title: "TVA et paie : des travaux préparatoires", description: "Les déclarations TVA et leurs exports doivent être validés avec votre conseil fiscal. La paie couvre une préparation de base ; les variables, la validation finale et les déclarations sociales ne constituent pas un cycle de paie complet livré." },
    { title: "Certaines vues restent en consultation", description: "Plusieurs écrans RH, notamment les congés, présences et frais, sont des consultations sans parcours complet de création et d’approbation. Le détail complet des contrats et la génération d’attestations ne sont pas promis." },
    { title: "Les fonctions « à venir » sont exclues", description: "L’inventaire physique, l’agenda et les écrans signalés « à venir » ne sont pas opérationnels. Ils ne sont pas présentés comme des fonctions utilisables dans votre devis." },
  ],
  questions: [
    { question: "Pourquoi PRO est-il uniquement sur devis ?", answer: "Le projet dépend des métiers concernés et des parcours que vous souhaitez mettre en place. Notre équipe précise les fonctions utilisables et vous transmet une proposition ; aucun prix PRO ni achat direct en ligne n’est proposé." },
    { question: "PRO comprend-il les fonctions ESSENTIEL ?", answer: "Oui. Le suivi courant des ventes, achats, clients, fournisseurs, règlements et trésorerie reste inclus. PRO ajoute les fonctions avancées prévues au devis, avec jusqu’à " + plan.limits.users + " utilisateurs pour votre entreprise." },
    { question: "La paie et la TVA peuvent-elles être utilisées sans validation professionnelle ?", answer: "Non. Ces fonctions servent à préparer et contrôler des données. Elles ne remplacent pas la validation de votre expert-comptable, de votre conseil fiscal ou de votre conseil social. Aucune déclaration officielle DGI ou sociale n’est transmise automatiquement." },
    { question: "Comment préparer une demande de devis utile ?", answer: "Indiquez les métiers concernés, le nombre d’utilisateurs et les parcours prioritaires : par exemple devis et livraisons, achats et réceptions, stock, suivi comptable ou dossiers du personnel. Notre équipe vous aide à cadrer le périmètre disponible." },
  ],
  nextHeading: "Parlons des besoins de votre entreprise.",
  nextDescription: "Décrivez votre activité et les parcours à relier. Nous préparons avec vous le périmètre de votre projet PRO.",
  related: { href: "/essentiel", label: "Commencer avec ESSENTIEL" },
};

export default function ProProductPage() {
  return <ProductOfferPage content={content} />;
}
