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
  publishedAt: string;
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
    title: "Logiciel de facturation au Maroc | Felexia",
    description: `Logiciel de facturation au Maroc : factures, avoirs, ICE, règlements et déclaration TVA (XML SIMPL-TVA). ESSENTIEL à ${monthly} MAD HT/mois, essai 15 jours.`,
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
        heading: "Mentions obligatoires, ICE et numérotation continue",
        paragraphs: [
          "Le PDF reprend votre logo, vos coordonnées et l’ICE lorsqu’ils sont renseignés. L’ICE compte 15 chiffres. L’IF et le RC s’affichent s’ils sont dans les paramètres. La numérotation des factures suit le compteur de l’entreprise, y compris pour une pièce annulée.",
          "Ces mentions aident à établir une facture de vente. Elles ne remplacent pas la lecture de l’article 145 du code général des impôts avec votre conseil.",
        ],
      },
      {
        heading: "Avoirs plutôt que facture modifiée",
        paragraphs: [
          "Une facture déjà émise se corrige par un avoir, pas en réécrivant la pièce. Le solde restant à encaisser tient compte de cet avoir et des règlements, partiels ou complets.",
        ],
      },
      {
        heading: "Déclaration de TVA et export SIMPL-TVA",
        paragraphs: [
          "ESSENTIEL prépare la déclaration de TVA et l’export XML du relevé de déductions SIMPL-TVA. Vous déposez ce fichier vous-même sur SIMPL. Felexia n’envoie rien à la DGI.",
          `${billingFacts} Le socle comprend 1 entreprise, jusqu’à ${users} utilisateurs, ${documents} documents commerciaux par mois et ${storage} Go de stockage. Les journaux de vente, d’achat, de banque et de caisse restent consultables.`,
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
          "ESSENTIEL et PRO incluent un parcours de facture électronique complet : génération PDF/XML, émission et archivage des factures et avoirs clients validés, après activation par l’administrateur.",
          "Ce parcours n’attend plus que l’entrée en vigueur de la loi sur la facture électronique au Maroc. D’ici là, aucune facture n’est transmise automatiquement à l’administration.",
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
        answer: "Non. Le parcours PDF/XML est complet, mais aucune facture n’est transmise automatiquement. La connexion et la signature attendront l’entrée en vigueur de la loi.",
      },
    ],
    cta: {
      label: "Essayer gratuitement",
      href: "/login?mode=register",
      note: "Sans carte bancaire. La création du compte ouvre ensuite la confirmation de votre entreprise.",
    },
    related: [
      { href: "/blog/retenue-source-auto-entrepreneur-plf-2027", label: "Retenue à la source des auto-entrepreneurs" },
      { href: "/blog/facture-auto-entrepreneur-maroc", label: "Facture d’auto-entrepreneur" },
      { href: "/blog/ice-facture-maroc", label: "ICE sur la facture" },
      { href: "/blog/modele-facture-maroc-ice", label: "Modèle de facture avec ICE" },
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
      { href: "/blog/numerotation-facture-maroc", label: "Numérotation des factures" },
      { href: "/blog/avoir-facture-maroc", label: "Avoir sur une facture" },
      { href: "/blog/declaration-tva-export-simpl", label: "Déclaration de TVA et export SIMPL-TVA" },
      { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
      { href: "/essentiel", label: "Détail de l’offre ESSENTIEL" },
      { href: "/pricing", label: "Tarifs ESSENTIEL et PRO" },
      { href: "/blog/choisir-entre-essentiel-et-pro", label: "Choisir entre ESSENTIEL et PRO" },
    ],
  },
  {
    kind: "landing",
    path: "/facturation-electronique-maroc",
    title: "Facture électronique au Maroc | FelexiaERP",
    description: "Facture électronique au Maroc : parcours PDF, XML, émission et archivage déjà complet, inclus ESSENTIEL et PRO. Connexion DGI et signature non activées.",
    eyebrow: "Facture électronique · Maroc",
    h1: "Facture électronique au Maroc : un parcours déjà complet",
    introduction: "Le parcours de facture électronique de Felexia est complet : génération PDF et XML, émission et archivage des factures et avoirs clients déjà validés. Il est inclus dans ESSENTIEL et dans PRO. Il n’attend plus que l’entrée en vigueur de la loi sur la facture électronique au Maroc.",
    publishedAt: "2026-11-03",
    sections: [
      {
        heading: "Ce que Felexia fait déjà : PDF, XML, émission et archivage",
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
        heading: "Un parcours complet, prêt pour la loi",
        paragraphs: [
          "Le parcours de facture électronique de Felexia est complet : génération PDF et XML, émission, archivage de la version retenue et téléchargements. Il n’attend plus que l’entrée en vigueur de la loi sur la facture électronique au Maroc.",
          "Dès que la loi s’appliquera et que la plateforme officielle de la DGI sera ouverte, Felexia activera la connexion et la signature requises. D’ici là, aucune facture ni déclaration n’est transmise automatiquement à l’administration.",
          "L’article 145-IX inscrit le principe d’une facture électronique. Le décret d’application n’est pas publié : aucun seuil, aucune date d’obligation et aucun format officiel ne sont annoncés ici. Le détail sourcé est dans l’état des lieux.",
        ],
      },
      {
        heading: "Inclus dans ESSENTIEL et dans PRO",
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
        answer: "Non. Le parcours est complet, mais aucune facture n’est transmise automatiquement. La connexion et la signature seront activées lorsque la loi s’appliquera et que la plateforme officielle de la DGI sera ouverte.",
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
      { href: "/blog/facture-electronique-pdf-xml", label: "PDF et XML d’une facture" },
      { href: "/blog/declaration-tva-export-simpl", label: "Déclaration de TVA et export SIMPL-TVA" },
      { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation au Maroc" },
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
      { href: "/pricing", label: "Voir les tarifs" },
      { href: "/blog/choisir-entre-essentiel-et-pro", label: "ESSENTIEL ou PRO" },
      { href: "/pro", label: "Périmètre de l’ERP PRO" },
    ],
  },
  {
    kind: "landing",
    path: "/declaration-tva-maroc",
    title: "Déclaration TVA et export SIMPL | Felexia",
    description: "Préparez votre déclaration de TVA au Maroc et exportez le relevé XML SIMPL-TVA. Inclus dans ESSENTIEL et PRO. Le dépôt sur SIMPL reste à votre charge.",
    eyebrow: "Déclaration TVA · Maroc",
    h1: "Déclaration de TVA au Maroc et export SIMPL-TVA",
    introduction: "Felexia prépare la déclaration de TVA et le relevé XML SIMPL-TVA à partir des factures déjà enregistrées. Vous téléchargez le fichier, puis vous le déposez vous-même sur SIMPL. Aucune déclaration n’est transmise à la DGI.",
    publishedAt: "2026-11-19",
    sections: [
      {
        heading: "Préparer la période, mensuelle ou trimestrielle",
        paragraphs: [
          "Vous ouvrez une déclaration pour le mois ou le trimestre concerné. Les montants viennent des factures de vente, des avoirs et des factures fournisseurs déjà saisies, avec le régime et la périodicité de l’entreprise.",
          "Le même espace sert une PME à Casablanca, Rabat, Marrakech ou ailleurs au Maroc. Felexia n’a pas d’agence locale : la déclaration se prépare en ligne, puis le dépôt se fait sur le portail de la DGI.",
        ],
      },
      {
        heading: "Contrôler les anomalies avant l’export",
        paragraphs: [
          "Avant de produire le XML, l’écran signale ce qui empêcherait un fichier exploitable : identifiant manquant, période incohérente, montant qui ne se recoupe pas. Vous corrigez la pièce, puis vous relancez le contrôle.",
          "Ce contrôle aide à préparer le relevé. Il ne garantit pas l’acceptation du fichier par SIMPL, et il ne choisit pas le régime de TVA à votre place.",
        ],
      },
      {
        heading: "Télécharger le relevé XML et le déposer sur SIMPL",
        paragraphs: [
          "L’export SIMPL-TVA est le relevé de déductions au format XML attendu pour le téléservice. Vous le téléchargez depuis la déclaration, puis vous l’importez vous-même sur SIMPL, en mode EDI, avant de valider le dépôt.",
          "Felexia génère le fichier. Il ne se connecte pas à SIMPL, ne signe pas le dépôt et n’envoie rien à l’administration. Le pas à pas illustré est dans le tutoriel, avec des données fictives.",
        ],
      },
      {
        heading: "Inclus dès ESSENTIEL",
        paragraphs: [
          `${billingFacts} La déclaration de TVA et l’export XML sont dans ESSENTIEL comme dans PRO. Les devis, le stock et la paie restent dans PRO.`,
          "Les fonctions fiscales sont préparatoires. Elles ne remplacent pas votre expert-comptable ni votre conseil fiscal.",
        ],
      },
    ],
    questions: [
      {
        question: "La déclaration de TVA est-elle dans ESSENTIEL ?",
        answer: "Oui. La préparation de la déclaration et l’export XML SIMPL-TVA sont inclus dans ESSENTIEL et dans PRO. Le dépôt sur le portail SIMPL reste à votre charge.",
      },
      {
        question: "Felexia dépose-t-il le fichier sur SIMPL ?",
        answer: "Non. Vous téléchargez le XML, puis vous l’importez et vous le validez sur SIMPL. Aucune déclaration n’est transmise automatiquement à la DGI.",
      },
      {
        question: "Le XML est-il une acceptation fiscale ?",
        answer: "Non. C’est le fichier préparé dans Felexia. L’administration n’accuse réception de rien tant que vous n’avez pas terminé le dépôt sur SIMPL.",
      },
      {
        question: "Où voir le parcours en images ?",
        answer: "Le tutoriel Déclaration de TVA et export SIMPL-TVA montre les écrans, avec une société de test. Le PDF associé se demande par le formulaire e-mail des guides. Il n’est pas en téléchargement libre.",
      },
    ],
    cta: {
      label: "Essayer gratuitement",
      href: "/login?mode=register",
      note: `Essai ESSENTIEL de ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire. Le dépôt SIMPL n’est pas inclus.`,
    },
    related: [
      { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel export SIMPL-TVA" },
      { href: "/blog/tva-maroc-pme", label: "TVA au Maroc pour une PME" },
      { href: "/logiciel-comptabilite-maroc", label: "Logiciel de comptabilité" },
      { href: "/essentiel", label: "Offre ESSENTIEL" },
      { href: "/pricing", label: "Tarifs" },
    ],
  },
  {
    kind: "landing",
    path: "/logiciel-comptabilite-maroc",
    title: "Logiciel de comptabilité au Maroc | Felexia",
    description: `Logiciel de comptabilité pour PME au Maroc : journaux, trésorerie et déclaration TVA (export XML SIMPL-TVA). Inclus dans ESSENTIEL à ${monthly} MAD HT/mois.`,
    eyebrow: "Comptabilité · Maroc",
    h1: "Logiciel de comptabilité pour PME au Maroc",
    introduction: "Felexia tient les journaux de vos ventes, de vos achats et de votre trésorerie, puis prépare la déclaration de TVA. C’est un outil de gestion pour l’entreprise, pas un logiciel de cabinet. Votre expert-comptable reste celui qui valide les écritures.",
    publishedAt: "2026-11-19",
    sections: [
      {
        heading: "Journaux de ventes, d’achats et de trésorerie",
        paragraphs: [
          "Dans ESSENTIEL, une facture validée, un avoir ou un règlement laisse une écriture dans le journal de vente, d’achat, de banque ou de caisse. Vous retrouvez la pièce et le montant au même endroit, en dirhams.",
          "Ces journaux servent à suivre l’activité et à préparer l’échange avec votre comptable. Ils ne constituent pas une comptabilité certifiée.",
        ],
      },
      {
        heading: "Déclaration de TVA et export SIMPL-TVA",
        paragraphs: [
          "La déclaration de TVA et l’export XML du relevé de déductions sont dans le même socle. Vous contrôlez la période, vous téléchargez le fichier, et vous le déposez vous-même sur SIMPL.",
          "Felexia n’envoie ni la déclaration ni les factures à la DGI. La connexion officielle et la signature électronique ne sont pas activées.",
        ],
      },
      {
        heading: "Ce que PRO ajoute, et ce que votre conseil valide",
        paragraphs: [
          "PRO, sur devis, ajoute le plan comptable, le grand livre, la balance, le rapprochement bancaire et les prévisions de trésorerie. Une liasse de gestion — bilan, CPC, ESG — peut être préparée à partir des écritures. Ce n’est pas une liasse certifiée et ce n’est pas un dépôt fiscal.",
          "Les taux, le rattachement des comptes et la liasse se relisent avec votre expert-comptable. Felexia prépare des états. Il ne se substitue pas à cette validation.",
        ],
      },
    ],
    questions: [
      {
        question: "La comptabilité de base est-elle dans ESSENTIEL ?",
        answer: `Oui. Les journaux, les écritures liées aux factures et aux règlements, et la déclaration de TVA avec l’export SIMPL-TVA sont dans ESSENTIEL, à ${monthly} HT MAD par mois. Le plan comptable, le grand livre et la balance sont dans PRO.`,
      },
      {
        question: "Felexia remplace-t-il l’expert-comptable ?",
        answer: "Non. Le logiciel aide à rassembler les pièces et à préparer des états. La validation comptable et fiscale reste celle de votre conseil.",
      },
      {
        question: "La liasse est-elle déposée automatiquement ?",
        answer: "Non. PRO peut préparer une liasse de gestion à partir des écritures, pour la relire. Elle n’est ni certifiée ni transmise à l’administration.",
      },
      {
        question: "Où commence-t-on ?",
        answer: `Par l’essai ESSENTIEL de ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire, si vous facturez et suivez les journaux. Le plan comptable et le grand livre se demandent avec PRO, sur devis.`,
      },
    ],
    cta: {
      label: "Essayer gratuitement",
      href: "/login?mode=register",
      note: `Journaux et déclaration TVA dans ESSENTIEL. PRO, pour le grand livre et la balance, est sur devis.`,
    },
    related: [
      { href: "/declaration-tva-maroc", label: "Déclaration de TVA et SIMPL" },
      { href: "/blog/tva-maroc-pme", label: "TVA au Maroc pour une PME" },
      { href: "/essentiel", label: "Offre ESSENTIEL" },
      { href: "/pro", label: "Comptabilité étendue dans PRO" },
      { href: "/pricing", label: "Tarifs" },
    ],
  },
  {
    kind: "landing",
    path: "/logiciel-paie-maroc",
    title: "Logiciel de paie CNSS au Maroc | Felexia",
    description: "Logiciel de paie pour PME au Maroc : bulletins, CNSS, AMO et IR, dans Felexia PRO. Les dépôts Damancom et SIMPL restent effectués par l’entreprise.",
    eyebrow: "Paie · Maroc",
    h1: "Logiciel de paie pour PME au Maroc",
    introduction: "Felexia PRO prépare les dossiers du personnel et les bulletins. La CNSS, l’AMO et l’IR se calculent dans cet espace pour être relus. Les dépôts Damancom et SIMPL restent faits par l’entreprise. PRO est sur devis.",
    publishedAt: "2026-11-19",
    sections: [
      {
        heading: "Dossiers, périodes et bulletins",
        paragraphs: [
          "Vous enregistrez les salariés et leurs contrats, puis vous ouvrez une période de paie. Le bulletin préparatoire reprend le salaire de base. Un bulletin plus complet peut ajouter les primes, l’ancienneté, les heures supplémentaires, les indemnités et les avances du mois.",
          "Le bulletin se consulte et s’imprime. Il reste une préparation : la validation finale et le paiement ne sont pas un cycle de paie clos à votre place.",
        ],
      },
      {
        heading: "CNSS, AMO et IR, sans dépôt Damancom",
        paragraphs: [
          "L’écran CNSS / AMO liste les éléments déclarables et signale un numéro CNSS qui n’a pas 9 chiffres. Vous pouvez télécharger un bordereau de salaires préparatoire, au format texte. Ce fichier n’est pas un dépôt Damancom.",
          "L’IR du salaire est estimé à partir des paramètres enregistrés. Un état 9421 préparatoire cumule la base imposable et l’IR retenu sur l’année. Ce n’est pas le dépôt EDI officiel.",
        ],
      },
      {
        heading: "Ce qui reste hors du logiciel",
        paragraphs: [
          "Felexia ne télé-déclare pas la CNSS, ne génère pas le fichier Damancom officiel et ne verse rien à l’administration. Les congés, les présences et les notes de frais ne forment pas, à eux seuls, un circuit d’approbation complet.",
          "Les barèmes et les montants se valident avec votre conseil social et votre expert-comptable. La paie est dans PRO, pas dans ESSENTIEL.",
        ],
      },
    ],
    questions: [
      {
        question: "La paie est-elle dans ESSENTIEL ?",
        answer: "Non. Les dossiers du personnel, les bulletins, la CNSS, l’AMO et l’IR préparatoires sont dans Felexia PRO, sur devis. ESSENTIEL couvre la facturation, les journaux et la déclaration de TVA.",
      },
      {
        question: "Felexia dépose-t-il la CNSS sur Damancom ?",
        answer: "Non. Le bordereau téléchargé est préparatoire. Le dépôt Damancom, comme le dépôt SIMPL de la TVA, est fait par l’entreprise.",
      },
      {
        question: "Le bulletin est-il un bulletin officiel ?",
        answer: "C’est le bulletin préparé dans Felexia, à partir des éléments saisis. Il ne remplace pas la validation de votre conseil, ni une déclaration sociale déjà déposée.",
      },
      {
        question: "Comment demander PRO ?",
        answer: "Depuis la page PRO, le bouton ouvre un brouillon d’e-mail. Le message n’est envoyé que lorsque vous le transmettez. Indiquez le nombre de salariés et ce que vous voulez préparer.",
      },
    ],
    cta: {
      label: "Voir Felexia PRO",
      href: "/pro",
      note: "PRO est sur devis. Aucun prix de paie n’est affiché en ligne.",
    },
    related: [
      { href: "/pro", label: "Périmètre de l’ERP PRO" },
      { href: "/blog/erp-maroc-pme", label: "ERP pour une PME au Maroc" },
      { href: "/essentiel", label: "Ce qui est déjà dans ESSENTIEL" },
      { href: "/pricing", label: "Tarifs" },
    ],
  },
  {
    kind: "landing",
    path: "/logiciel-gestion-stock-maroc",
    title: "Logiciel de gestion de stock Maroc | Felexia",
    description: "Logiciel de gestion de stock au Maroc : mouvements, réceptions et livraisons, reliés aux ventes et aux achats. Fonction de Felexia PRO, sur devis.",
    eyebrow: "Stock · Maroc",
    h1: "Logiciel de gestion de stock pour PME au Maroc",
    introduction: "Felexia PRO relie les quantités aux documents : commande fournisseur, réception, commande client, livraison et retour. ESSENTIEL facture et encaisse, sans suivi d’emplacements. Le stock se prépare sur devis.",
    publishedAt: "2026-11-19",
    sections: [
      {
        heading: "Emplacements, entrées, sorties et transferts",
        paragraphs: [
          "Vous retrouvez les articles suivis, leur quantité et les emplacements. Une entrée, une sortie, un transfert ou un ajustement laisse un mouvement daté. L’historique sert à expliquer pourquoi une quantité a changé.",
          "Un transfert déplace la marchandise d’un emplacement à un autre. Il ne la fait pas sortir de l’entreprise. Une alerte signale les articles passés sous leur seuil.",
        ],
      },
      {
        heading: "Réceptions fournisseurs et livraisons clients",
        paragraphs: [
          "Côté achats, la commande fournisseur puis la réception disent ce qui est arrivé. La facture fournisseur, elle, dit ce qui est dû : les deux pièces ne se remplacent pas. Côté ventes, le devis peut devenir une commande, puis une livraison ou un retour.",
          "La facture de vente et le règlement restent le socle ESSENTIEL, inclus dans PRO. Le stock nommé ici est celui de PRO.",
        ],
      },
      {
        heading: "Inventaire physique, sans valorisation imposée",
        paragraphs: [
          "Une session d’inventaire physique permet de compter un emplacement, puis de valider l’écart. Elle n’invente pas une méthode comptable et ne remplace pas l’avis de votre expert-comptable sur la valorisation.",
          "Felexia n’est pas une caisse de magasin. Il n’y a pas de point de vente boutique ou restaurant dans ce parcours.",
        ],
      },
    ],
    questions: [
      {
        question: "Le stock est-il dans ESSENTIEL ?",
        answer: "Non. Les emplacements, les mouvements, les réceptions et les livraisons sont dans Felexia PRO, sur devis. ESSENTIEL couvre les factures, les règlements, les journaux et la déclaration de TVA.",
      },
      {
        question: "Une réception tient-elle lieu de facture ?",
        answer: "Non. La réception suit la marchandise liée à la commande. La facture fournisseur et le paiement suivent le montant dû.",
      },
      {
        question: "Puis-je faire un inventaire ?",
        answer: "Oui, dans PRO : une session compte un emplacement et enregistre l’écart. Ce comptage ne vaut pas une valorisation comptable validée.",
      },
      {
        question: "Comment voir le détail ?",
        answer: "L’article Gestion de stock au Maroc reprend le circuit, avec un exemple fictif. La mise en place se demande sur la page PRO.",
      },
    ],
    cta: {
      label: "Demander un devis PRO",
      href: "/pro",
      note: "Le bouton de la page PRO ouvre un brouillon. Aucun prix de stock n’est publié.",
    },
    related: [
      { href: "/blog/gestion-de-stock-au-maroc", label: "Gestion de stock au Maroc" },
      { href: "/logiciel-devis-facture-maroc", label: "Devis, commandes et factures" },
      { href: "/pro", label: "ERP PRO" },
      { href: "/blog/erp-maroc-pme", label: "ERP pour une PME" },
      { href: "/essentiel", label: "Facturer sans stock, avec ESSENTIEL" },
    ],
  },
  {
    kind: "landing",
    path: "/logiciel-devis-facture-maroc",
    title: "Logiciel devis et facture au Maroc | Felexia",
    description: "Devis, commandes et factures pour PME au Maroc. La facture est dans ESSENTIEL ; les devis et le cycle commercial complet sont dans Felexia PRO.",
    eyebrow: "Devis et factures · Maroc",
    h1: "Devis et factures pour les PME au Maroc",
    introduction: "La facture de vente, l’avoir et le règlement sont dans ESSENTIEL. Le devis, la commande, la livraison et le retour sont dans PRO. Les deux offres ne promettent pas la même chose : la frontière est celle du produit.",
    publishedAt: "2026-11-19",
    sections: [
      {
        heading: "La facture, dans ESSENTIEL",
        paragraphs: [
          "Vous choisissez le client, vous saisissez des articles ou des lignes libres, et vous vérifiez le HT, la TVA et le TTC. Le PDF reprend le logo, l’ICE, l’IF et le RC lorsqu’ils sont renseignés. Un avoir corrige une facture déjà émise.",
          `${billingFacts}`,
        ],
      },
      {
        heading: "Le devis et la commande, dans PRO",
        paragraphs: [
          "PRO ajoute le prospect, le devis, la conversion en commande, la livraison et le retour client. Côté achats, la commande fournisseur et la réception s’ajoutent aux factures déjà présentes dans ESSENTIEL.",
          "Chercher un devis dans ESSENTIEL mène à côté. L’essai gratuit ouvre ESSENTIEL. Le cycle commercial se demande avec PRO, sur devis, sans prix affiché.",
        ],
      },
      {
        heading: "Ce que ce parcours ne fait pas",
        paragraphs: [
          "Aucune facture n’est envoyée seule à la DGI. Le parcours de facture électronique — PDF, XML, émission et archivage — est complet et attend l’entrée en vigueur de la loi. La connexion officielle et la signature ne sont pas activées.",
          "Le dépôt de la déclaration de TVA sur SIMPL reste le vôtre, que vous facturiez dans ESSENTIEL ou dans PRO.",
        ],
      },
    ],
    questions: [
      {
        question: "Puis-je faire un devis avec ESSENTIEL ?",
        answer: "Non. ESSENTIEL établit les factures, les avoirs et les règlements. Les devis, les commandes et les livraisons sont dans PRO.",
      },
      {
        question: "La facture électronique est-elle réservée à PRO ?",
        answer: "Non. La génération PDF et XML, l’émission et l’archivage sont dans les deux offres, après activation par l’administrateur. Cela n’ouvre pas la connexion à la DGI.",
      },
      {
        question: "Comment essayer la facturation ?",
        answer: `L’essai ESSENTIEL dure ${DEFAULT_TRIAL_DURATION_LABEL} et ne demande pas de carte bancaire. Il ne donne pas accès aux devis ni au stock.`,
      },
      {
        question: "Comment demander les devis et les commandes ?",
        answer: "Sur la page PRO. Le bouton ouvre un brouillon d’e-mail, que vous envoyez vous-même. Aucun prix PRO n’est publié.",
      },
    ],
    cta: {
      label: "Essayer la facturation",
      href: "/login?mode=register",
      note: "L’essai ouvre ESSENTIEL. Les devis et le cycle commercial se demandent avec PRO.",
    },
    related: [
      { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation" },
      { href: "/pro", label: "Devis et commandes dans PRO" },
      { href: "/blog/choisir-entre-essentiel-et-pro", label: "ESSENTIEL ou PRO" },
      { href: "/facturation-electronique-maroc", label: "Facture électronique" },
      { href: "/pricing", label: "Tarifs" },
    ],
  },
];

export const GUIDES: readonly PublicGuide[] = [...LANDING_GUIDES];

export function getGuide(path: PublicGuide["path"]): PublicGuide {
  const guide = GUIDES.find((item) => item.path === path);
  if (!guide) throw new Error("Missing public guide: " + path);
  return guide;
}
