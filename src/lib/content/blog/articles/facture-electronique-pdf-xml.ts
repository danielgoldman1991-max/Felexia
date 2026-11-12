import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "12/11/2026";

const article: BlogArticle = {
  slug: "facture-electronique-pdf-xml",
  path: "/blog/facture-electronique-pdf-xml",
  title: "Facture électronique PDF XML : la différence | Felexia",
  description: "Facture électronique PDF XML : page lisible ou fichier de données, et ce que l’article 145-IX du CGI ne fixe ni en date ni en format au Maroc.",
  h1: "PDF, XML, facture électronique : quelle différence pour une PME ?",
  category: "facture-electronique",
  publishedAt: "2026-11-12",
  updatedAt: "2026-11-12",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-facture-electronique-pdf-xml.webp",
    avif: "/images/blog/blog-facture-electronique-pdf-xml.avif",
    alt: "Illustration d’une page de document qui se disperse en cubes vers un arbre de blocs colorés, en bleu et menthe.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "Un PDF est une page à lire ou à imprimer. Un fichier de données, souvent en XML, sépare les champs pour un autre logiciel.",
    "Cette distinction est pédagogique. L’édition 2026 du CGI ne définit ni « PDF » ni « XML », et n’emploie pas « facture électronique » ni « facturation électronique ».",
    "L’article 145-IX demande un système informatique de facturation à certains contribuables et renvoie les modalités à un règlement. Il ne fixe ni date, ni seuil, ni format.",
    "Au 12 novembre 2026, les sommaires du Bulletin officiel ne renvoient pas de décret pour ces deux expressions. Un PDF envoyé par e-mail n’est pas, à lui seul, un flux de données.",
  ],
  introduction: [
    "PDF, XML et facture électronique ne désignent pas la même chose. Le PDF est la page que vous lisez. Le XML est une façon courante d’écrire des données pour un logiciel. La facture électronique, au sens d’un flux structuré, n’est pas définie par ces mots dans le Code général des impôts. ",
    "L’article 145-IX pose un principe et renvoie le reste à un règlement. Le détail de l’état des textes est dans ",
    { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Facture électronique au Maroc : où en est-on ?" },
    ".",
  ],
  blocks: [
    h2("page-ou-donnees", "PDF, XML, facture électronique : quelle différence ?"),
    p("Un PDF fige la page : en-tête, lignes, totaux. Vous pouvez l’imprimer ou le joindre à un message. Un autre logiciel n’y trouve pas forcément le client, la taxe et le total dans des cases séparées."),
    p("Un fichier de données, souvent en XML, range les mêmes informations dans des champs qu’une machine peut lire. Ni la page ni le fichier n’est, par sa seule forme, une transmission à l’administration. Le tableau classe des usages, pas une règle marocaine."),
    {
      type: "table",
      caption: "Distinction pédagogique, pas une catégorie du CGI",
      columns: ["Support", "Pour une personne", "Pour un logiciel", "Ce que le CGI en dit"],
      rows: [
        ["PDF", "Page à lire ou à imprimer", "Pas nécessairement des champs séparés", "Ni le mot PDF, ni un circuit d’e-mail"],
        ["XML, fichier de données", "Peu lisible tel quel", "Champs séparés, si le fichier est bien formé", "Aucun format nommé"],
        ["Flux de données", "Peut s’ajouter à la page", "Envoi structuré, pas seulement une pièce jointe", "Non défini par ces mots. Modalités renvoyées au règlement"],
      ],
    },
    h2("article-145-ix", "Que fixe l’article 145-IX, et que ne fixe-t-il pas ?"),
    p("L’article 145-IX, édition 2026, vise l’impôt sur les sociétés, l’impôt sur le revenu professionnel au réel ou au simplifié, et les assujettis à la TVA. Ils doivent se doter d’un système informatique de facturation aux critères techniques de l’administration, conformément aux III et IV. Les modalités sont fixées par voie réglementaire, par secteur. La note 1064 renvoie à l’article 8 de la loi de finances n° 68-17 pour 2018."),
    p("En vigueur à côté : la série et les mentions du 145-III, l’ICE du vendeur au VIII. Le XI écarte la contribution professionnelle unique et l’auto-entrepreneur, sauf l’adresse électronique du X. Le ",
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "guide des mentions" },
      " détaille le III, et le ",
      { href: "/blog/modele-facture-maroc-ice", label: "modèle avec ICE" },
      " montre une pièce annotée."),
    p("Non fixé dans le IX : la date, le seuil et le format. Le 12 novembre 2026, les sommaires du Bulletin officiel, du 1er janvier 2018 à cette date, ne renvoient aucun texte pour « facturation électronique », « facture électronique » et « système informatique de facturation ». La recherche porte sur les sommaires indexés."),
    h2("email-pdf", "Un e-mail avec un PDF suffit-il ?"),
    p("Envoyer le PDF remet la page au client. Les champs ne partent pas séparément, et ce message n’est pas le règlement du 145-IX. Un XML ne prouve pas non plus une réception par l’administration."),
    h2("exemple-fictif", "Exemple fictif : la même vente, deux lectures"),
    p("L’Imprimerie des Oliviers, à Rabat, n’existe pas. Deux ramettes à 40,00 dirhams hors taxe font 80,00. La taxe à 20 %, taux normal de l’article 99-A si l’opération n’est pas au 99-B, fait 16,00. Le total fait 96,00. L’ICE de démonstration est 000000000000000."),
    {
      type: "example",
      kicker: "Exemple fictif",
      title: "Même vente, page ou champs",
      note: "Les noms de champs sont une illustration. Ils ne sont pas un format imposé.",
      rows: [
        { label: "Sur le PDF", value: "2 ramettes, 80,00 MAD hors taxe, taxe 16,00, total 96,00", annotation: "Page lisible. 2 × 40,00 = 80,00. 80,00 + 16,00 = 96,00." },
        { label: "Dans un fichier de données", value: "vendeur, quantité 2, hors taxe 80,00, taxe 16,00, total 96,00", annotation: "Champs séparés, pour l’exemple. Pas un schéma officiel." },
        { label: "ICE", value: "000000000000000", annotation: "145-VIII. Démonstration." },
        { label: "E-mail du PDF", value: "Remis au client fictif", annotation: "Page envoyée. Pas une transmission administrative." },
      ],
    },
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Le 145-IX dépend du régime. Le XI en écarte d’autres, sauf l’adresse électronique. Le taux de 20 % de l’exemple est celui de l’article 99-A, pas celui des opérations listées au 99-B.",
      ]],
    },
    h2("erreurs-frequentes", "Erreurs fréquentes"),
    p("Appeler « facture électronique » tout PDF envoyé par e-mail, ou tenir un XML pour un format que le IX ne nomme pas. Le XI écarte l’auto-entrepreneur, sous réserve du paragraphe X."),
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "Depuis les factures et avoirs clients validés, ESSENTIEL et PRO génèrent un PDF et un XML, puis l’émission et l’archivage, après activation par l’administrateur. Felexia est prêt pour la facture électronique : le logiciel produit des factures en PDF et en XML et les archive. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Le XML généré ne constitue pas une acceptation fiscale. Les fonctions seront mises à jour à la publication des textes. Voir ",
        { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
        ", ",
        { href: "/logiciel-facturation-maroc", label: "le logiciel de facturation" },
        " et ",
        { href: "/essentiel", label: "ESSENTIEL" },
        ".",
      ], [
        offer.offerPitch,
      ]],
    },
  ],
  questions: [
    {
      question: "Un PDF envoyé par e-mail est-il une facture électronique structurée ?",
      answer: "Non, au sens pédagogique d’un flux de données. Le PDF remet une page à votre client. Il ne sépare pas, à lui seul, les champs pour un autre logiciel, et il ne constitue pas le texte réglementaire de l’article 145-IX. Le CGI, édition 2026, ne définit pas le mot PDF.",
    },
    {
      question: "Le XML est-il le format obligatoire au Maroc ?",
      answer: "Non. L’article 145-IX ne nomme aucun format. Au 12 novembre 2026, les sommaires du Bulletin officiel ne renvoient pas de décret pour « facture électronique » ni « facturation électronique ». Un fichier XML peut exister sans être le format d’un texte qui n’est pas publié.",
    },
    {
      question: "Que demande déjà le CGI ?",
      answer: "L’article 145-III demande une série continue et des mentions. Le VIII demande l’ICE sur les factures délivrées aux clients. Le IX demande un système informatique de facturation aux régimes qu’il vise, et renvoie les modalités à un règlement. Le XI écarte l’article 145 pour la contribution professionnelle unique et l’auto-entrepreneur, sauf l’adresse électronique.",
    },
    {
      question: "Felexia envoie-t-il le XML à la DGI ?",
      answer: "Non. Felexia est prêt pour la facture électronique au sens du PDF, du XML et de l’archivage, après activation par l’administrateur. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Le XML généré ne constitue pas une acceptation fiscale.",
    },
    {
      question: "Où voir le prix de ce parcours ?",
      answer: `La génération PDF/XML, l’émission et l’archivage sont inclus dans ESSENTIEL et dans PRO. ESSENTIEL est à ${offer.monthly} MAD HT par mois ou ${offer.yearly} MAD HT par an. L’essai dure ${offer.trial}, sans carte bancaire. PRO est sur devis.`,
    },
  ],
  cta: {
    label: `Essayer Felexia ${offer.trial}, sans carte bancaire`,
    href: "/login?mode=register",
    note: offer.offerPitch,
  },
  related: [
    { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
    { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation au Maroc" },
    { href: "/essentiel", label: "Offre ESSENTIEL" },
    { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Où en est la facture électronique" },
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
    { href: "/blog/modele-facture-maroc-ice", label: "Modèle de facture avec ICE" },
    { href: "/blog/logiciel-gestion-pme-maroc", label: "10 critères pour choisir un logiciel de gestion" },
  ],
  sources: [
    { label: "Direction générale des impôts — Code général des impôts, édition 2026 (fichier « CGI 2026 FR.pdf » sur tax.gov.ma). Articles 99-A, 99-B, 145 (III, VIII, IX, X, XI), note 1064, et article 211. Les expressions « facture électronique » et « facturation électronique » n’y figurent pas.", href: "https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES", consulted },
    { label: "Secrétariat général du gouvernement — recherche des sommaires du Bulletin officiel, expressions exactes « facturation électronique », « facture électronique » et « système informatique de facturation », du 1er janvier 2018 au 12 novembre 2026. Aucun texte renvoyé.", href: "https://www.sgg.gov.ma/Legislation/rechercheSommairesBO.aspx", consulted },
    { label: "Felexia — page Facture électronique au Maroc : PDF, XML, émission, archivage, activation par l’administrateur, absence de connexion officielle à la DGI", href: "/facturation-electronique-maroc", consulted },
    { label: "Felexia — page ESSENTIEL et page Tarifs : prix, essai de 15 jours et inclusion du parcours documentaire", href: "/pricing", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les règles évoluent : vérifiez auprès de l’administration fiscale ou de votre expert-comptable. Mis à jour le 12 novembre 2026.",
};

export default article;
