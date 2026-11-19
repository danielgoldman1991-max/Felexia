import { buildArticle, offer, type ArticleSpec } from "@/lib/content/blog/article-shell";

const tutorial = { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel déclaration TVA et export SIMPL-TVA" };
const tvaLanding = { href: "/declaration-tva-maroc", label: "Déclaration de TVA au Maroc" };
const essentiel = { href: "/essentiel", label: "Offre ESSENTIEL" };
function related(extra: { href: string; label: string }[]) {
  return [tutorial, tvaLanding, ...extra, essentiel];
}

const commonDisclaimer = "Contenu informatif. Les taux, les délais et le régime applicable se vérifient avec la DGI, la CNSS ou votre conseil. Felexia prépare des fichiers ; il ne les dépose pas.";

const specs: ArticleSpec[] = [];

specs.push({
  slug: "tva-encaissement-ou-debits-maroc",
  title: "TVA à l’encaissement ou sur les débits | Felexia",
  description: "TVA à l’encaissement ou sur les débits : ce que change la date dans Felexia, sans choisir le régime à votre place. Le dépôt SIMPL reste le vôtre.",
  h1: "TVA à l’encaissement ou sur les débits : ce que Felexia change dans la date",
  category: "tva-fiscalite",
  alt: "Fond bleu Felexia, sans photo, pour distinguer la TVA à l’encaissement et la TVA sur les débits.",
  essentials: [
    "Felexia connaît deux lectures : encaissement et débits. Le réglage mixte ou absent suit la date du paiement, comme l’encaissement.",
    "Sur les débits, la déduction préparée ne suit pas la date du règlement. Sur l’encaissement, elle la suit.",
    "Ce réglage ne dit pas quel régime la loi vous impose. Votre conseil le confirme.",
    "Le XML SIMPL-TVA se télécharge. Le dépôt sur SIMPL reste fait par l’entreprise.",
  ],
  introduction: [
    "La question n’est pas de deviner un taux. Elle est de savoir quelle date Felexia retient pour préparer la déclaration : celle de la facture, ou celle du paiement. ",
    "Le détail des délais déjà sourcés est dans ",
    { href: "/blog/tva-maroc-pme", label: "TVA au Maroc pour une PME" },
    ". Le pas à pas du fichier est dans le ",
    tutorial,
    ".",
  ],
  sections: [
    {
      id: "deux-reglages",
      title: "Deux réglages, pas un choix fiscal automatique",
      paragraphs: [
        "Dans les paramètres de TVA, l’entreprise peut être suivie à l’encaissement ou sur les débits. S’il n’y a pas de choix, ou si le réglage est mixte, l’export actuel rattache la déduction à la date du paiement, comme pour l’encaissement. Ce n’est pas un conseil. C’est le comportement du logiciel tant que vous n’avez pas indiqué les débits.",
        "Passer d’un réglage à l’autre déplace des montants d’une période à l’autre. Une facture de mars payée en avril n’apparaît pas au même endroit selon le régime. Avant de changer le paramètre, notez la période déjà déposée et demandez à votre conseil si le changement est possible pour votre activité.",
      ],
    },
    {
      id: "date",
      title: "Quelle date suit la déduction",
      paragraphs: [
        "Sur les débits, Felexia ne fait pas dépendre la déduction de la date de règlement. La pièce est lue selon sa date de facture. Sur l’encaissement, la déduction suit le paiement. Un règlement partiel ne couvre qu’une partie du montant : le reste attend un autre paiement, avec sa propre date.",
        "S’il manque une date de paiement unique, le logiciel ne fabrique pas une date. Il signale le cas. Vous corrigez le règlement, ou vous laissez la ligne de côté, plutôt que d’inventer un jour. Le tutoriel d’export montre ces contrôles sur une société fictive.",
      ],
    },
    {
      id: "exemple",
      title: "Un mois fictif, deux lectures",
      paragraphs: [
        "La société fictive Atelier Nador facture 10 000 MAD HT en mars, TVA en sus, et encaisse en avril. À l’encaissement, la déclaration de mars ne retient pas encore cet encaissement. Sur les débits, la facture est dans la période de mars. Les chiffres sont inventés pour montrer le décalage. Ils ne sont pas un barème.",
        "Le même atelier a une facture fournisseur de 4 000 MAD HT payée pour moitié en mars. À l’encaissement, seule la part payée entre dans le relevé de mars. Sur les débits, la date de facture compte, pas le chèque. Votre conseil dit laquelle de ces lectures est la vôtre.",
      ],
    },
    {
      id: "simpl",
      title: "Ce que le fichier SIMPL-TVA emporte",
      paragraphs: [
        "L’export écrit un code de régime : 1 quand ce n’est pas les débits, 2 quand le régime est les débits. Ce code décrit le fichier Felexia. Il ne remplace pas la notice du jour sur SIMPL. Si le portail attend autre chose, vous ne forcez pas le dépôt.",
        "Vous préparez la période, vous contrôlez les anomalies, vous téléchargez le XML, puis vous l’importez vous-même. Felexia ne se connecte pas à la DGI et ne signe pas le dépôt. Aucune déclaration n’est envoyée automatiquement.",
      ],
    },
    {
      id: "limites",
      title: "Ce que ce guide ne tranche pas",
      paragraphs: [
        "Il ne dit pas qui a le droit d’opter pour les débits, ni à quelle date l’option se prend, ni quel article du code s’applique à votre cas. Ces points se lisent sur les pages de la DGI et avec votre conseil. L’article déjà publié sur la TVA des PME renvoie aux textes qu’il a cités, avec sa date de lecture.",
        "Il ne donne pas non plus un taux. Les taux de vos factures sont ceux que vous avez saisis. S’ils sont faux dans le logiciel, ils seront faux dans le XML. Le contrôle d’export ne devine pas le bon taux.",
      ],
    },
    {
      id: "offre",
      title: "Où le faire dans Felexia",
      paragraphs: [
        `La déclaration et l’export SIMPL-TVA sont dans ESSENTIEL, à ${offer.monthly} HT MAD par mois, et aussi dans PRO. L’essai dure ${offer.trial}, sans carte bancaire. PRO ajoute d’autres parcours, pas une connexion à l’administration.`,
        "Commencez par une période de test, avec des pièces fictives si vous découvrez l’écran, puis seulement ensuite une période réelle. Le tutoriel et la page Déclaration de TVA décrivent le même geste : préparer ici, déposer là-bas.",
      ],
    },
  ],
  notes: [
    "Le régime se confirme avant la période, pas après le dépôt. Si vous hésitez entre l’encaissement et les débits, ne produisez pas deux fichiers « pour voir » et n’en validez qu’un au hasard. Demandez d’abord à votre conseil quelle date fait foi pour votre activité, puis réglez Felexia en conséquence.",
    "Un avoir client ou fournisseur déplace les montants. Il ne s’efface pas en supprimant la facture d’origine si le numéro a déjà été émis. La série des numéros et le traitement de l’avoir sont décrits dans les guides de facturation. Ici, retenez seulement que l’avoir entre dans la période selon le même régime que les factures.",
    "Gardez une trace de qui a préparé le fichier et de la période. Deux personnes ne doivent pas télécharger deux versions le même jour sans se les nommer. Le nom du fichier, la date et le régime suffisent comme mémo. Ce n’est pas une preuve de dépôt.",
  ],
  practice: [
    "Notez d’abord le régime affiché, puis la période que vous voulez préparer. Ouvrez les factures de vente, les avoirs et les factures fournisseurs de cette période. Vérifiez que chaque pièce a une date, un tiers et des montants HT, TVA et TTC qui se recoupent. Si un paiement est partiel, vérifiez qu’il a lui aussi une date. Ne complétez pas une date manquante avec le dernier jour du mois pour « faire passer » la ligne.",
    "Lancez le contrôle avant l’export. Lisez chaque anomalie : identifiant incomplet, période incohérente, montant qui ne tombe pas juste. Corrigez la pièce source, pas le XML à la main. Un fichier retouché à la main n’est plus celui que Felexia a préparé, et vous ne saurez plus le reconstruire.",
    "Téléchargez le XML seulement quand le contrôle ne montre plus les blocages que vous pouvez corriger. Gardez une copie du fichier avec le nom de la période. Le dépôt se fait ensuite sur SIMPL, par vous ou par la personne que vous mandatez. Felexia ne voit pas l’accusé du portail.",
    "Après le dépôt, ne changez pas les pièces de la période sans en mesurer l’effet. Une facture modifiée après coup ne met pas à jour une déclaration déjà envoyée. S’il faut une correction, votre conseil dit s’il s’agit d’une déclaration rectificative. Le logiciel peut préparer un nouvel état. Il ne rectifie rien auprès de l’administration.",
    "Gardez le lien entre le fichier, la période et les pièces. Le tutoriel montre cet enchaînement avec des données fictives et un PDF derrière le formulaire des guides. Ce PDF n’est pas une notice de la DGI. Les écrans du portail se lisent sur le site de l’administration, le jour où vous déposez.",
  ],
  example: {
    title: "Atelier Nador, mars puis avril",
    note: "Société fictive. Les montants servent à voir le décalage de date. Ils ne sont pas un cas réel.",
    rows: [
      { label: "Facture client", value: "10 000 HT en mars", annotation: "Encaissée en avril. Le régime décide de la période." },
      { label: "Achat", value: "4 000 HT, payé à moitié", annotation: "À l’encaissement, seule la part payée suit mars." },
      { label: "Fichier", value: "XML téléchargé", annotation: "Le dépôt sur SIMPL n’est pas fait par Felexia." },
    ],
  },
  checklist: [
    "Le régime affiché dans Felexia est celui que votre conseil a confirmé.",
    "Les paiements partiels ont une date, sans date inventée.",
    "Vous avez contrôlé les anomalies avant de télécharger le XML.",
    "Vous déposerez le fichier vous-même sur SIMPL.",
    "Vous n’avez pas changé de régime au milieu d’une période déjà déposée sans en parler.",
  ],
  questions: [
    { question: "Felexia choisit-il l’encaissement ou les débits ?", answer: "Non. Vous indiquez le régime. Sans indication, ou avec le réglage mixte, l’export suit la date de paiement. Le choix légal se confirme avec votre conseil." },
    { question: "Un paiement partiel est-il pris en entier ?", answer: "Non à l’encaissement. Seule la part payée, avec sa date, entre dans la déduction préparée. Le reste attend un autre règlement." },
    { question: "Le code 1 ou 2 du XML est-il une validation de la DGI ?", answer: "Non. C’est le code écrit par Felexia selon le régime paramétré. Le portail SIMPL reste l’endroit où vous déposez et où l’administration répond." },
    { question: "Faut-il PRO pour cet export ?", answer: "Non. La déclaration de TVA et l’export XML SIMPL-TVA sont dans ESSENTIEL et dans PRO. Le dépôt n’est dans aucune des deux offres." },
  ],
  related: related([{ href: "/blog/tva-maroc-pme", label: "TVA au Maroc pour une PME" }, { href: "/blog/modes-paiement-facture-maroc", label: "Modes de paiement et codes du relevé" }]),
  disclaimer: commonDisclaimer,
});

export const PR3_ARTICLES = specs.map(buildArticle);
