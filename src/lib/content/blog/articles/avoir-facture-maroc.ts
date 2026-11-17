import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "17/11/2026";

const article: BlogArticle = {
  slug: "avoir-facture-maroc",
  path: "/blog/avoir-facture-maroc",
  title: "Avoir facture Maroc : corriger sans trou de numéro | Felexia",
  description: "Avoir facture Maroc : corriger une pièce sans réutiliser son numéro, garder la série continue de l’article 145-III et conserver les doubles dix ans.",
  h1: "Avoir ou annulation : comment corriger une facture au Maroc sans casser la numérotation",
  category: "facturation",
  publishedAt: "2026-11-17",
  updatedAt: "2026-11-17",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-avoir-facture-maroc.webp",
    avif: "/images/blog/blog-avoir-facture-maroc.avif",
    alt: "Illustration de deux factures reliées par une flèche circulaire, au-dessus d’une suite de points bleus, menthe et or.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "L’article 145-III, édition 2026, demande une série continue. Un numéro déjà émis ne se retire pas et ne sert pas à une autre pièce.",
    "L’article 211 demande dix ans de conservation, au lieu d’imposition, pour les doubles des factures de vente et les pièces du contrôle.",
    "L’édition 2026 ne définit pas « avoir » et ne fixe pas de modèle. La forme du document se valide avec l’expert-comptable.",
    "L’article 151 vise les rabais, remises et ristournes après facturation. Il ne décrit ni un modèle d’avoir, ni une case de taxe.",
  ],
  introduction: [
    "Corriger une facture au Maroc sans casser la numérotation, c’est laisser le numéro émis et écrire la correction à part. ",
    "L’article 145-III demande la série continue. L’article 211 demande dix ans de conservation. L’édition 2026 ne définit pas le mot « avoir ». Les mentions de la pièce d’origine sont dans la ",
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "checklist de l’article 145" },
    ", et un exemple annoté est dans le ",
    { href: "/blog/modele-facture-maroc-ice", label: "modèle de facture avec ICE" },
    ".",
  ],
  blocks: [
    h2("numero", "Avoir facture Maroc : le numéro d’origine reste en place"),
    p("L’article 145-III, sous réserve du IX, demande des factures ou mémoires pré-numérotés, tirés d’une série continue, ou édités par un système informatique selon une série continue. Supprimer la pièce, ou réécrire le PDF sous le même numéro, ouvre un trou ou deux contenus pour un seul numéro."),
    p("Le document de correction prend un autre numéro. L’édition 2026 ne dit pas s’il partage la série des factures. Les deux pièces se conservent. Le paragraphe XI écarte l’article 145 pour la contribution professionnelle unique et l’auto-entrepreneur, sauf l’adresse électronique du X. Ce cas est dans ",
      { href: "/blog/facture-auto-entrepreneur-maroc", label: "Facture d’auto-entrepreneur au Maroc" },
      "."),
    h2("difference", "Avoir ou réécriture : quelle différence ?"),
    {
      type: "table",
      caption: "Trois gestes, et ce qu’il advient du numéro",
      columns: ["Geste", "Effet sur la série", "Documents à garder"],
      rows: [
        ["Réécrire la facture", "Deux contenus pour un numéro", "Les deux versions"],
        ["Retirer le numéro", "Un trou dans la suite", "La pièce et le motif"],
        ["Autre document", "La facture reste, la correction est numérotée", "Les deux pièces"],
      ],
    },
    p("Une erreur de quantité, un retour et une remise après facture ne sont pas le même geste. L’édition 2026 ne nomme pas ces gestes, et ne les réunit pas sous le mot « avoir »."),
    h2("cgi", "Ce que le CGI fixe, et la forme qu’il ne fixe pas"),
    p("La série continue est à l’article 145-III. L’article 211 demande dix ans, au lieu d’imposition, pour les doubles des factures de vente et les pièces nécessaires au contrôle. Le support est électronique si la comptabilité est tenue par procédé électronique, ou si l’article 145-I impose le format électronique."),
    p("L’édition 2026 ne définit pas « avoir » ni un modèle de facture rectificative. Si la correction est elle-même une facture ou un mémoire, l’article 145-III lui demande aussi la série et les mentions. Le code ne dit pas que tout document appelé avoir est une facture. Ce classement se fait avec l’expert-comptable."),
    h3("taxe", "Taxe et réduction de prix"),
    p("L’article 96 décrit le chiffre d’affaires imposable comme le prix des marchandises, travaux ou services et les recettes accessoires, hors taxe. Il ne décrit pas de ligne d’avoir. L’article 119-II rend redevable de la taxe la personne qui la mentionne sur les factures qu’elle établit, du seul fait de cette facturation."),
    p("L’article 151 demande de déclarer les rabais, remises et ristournes accordés après facturation, parmi les sommes allouées à des tiers visés par cet article. Il ne fixe ni la forme d’un avoir, ni une case de taxe."),
    h2("exemple-fictif", "Exemple fictif : deux bidons de trop"),
    p("L’Atelier des Dattes et la Maison du Thé n’existent pas. FAC-DEMO-0041 compte 10 bidons, la commande en prévoyait 8. On ne réécrit pas ce numéro. AV-DEMO-0007 constate les 2 bidons. ICE de démonstration : 000000000000000."),
    {
      type: "example",
      kicker: "Exemple fictif",
      title: "Facture FAC-DEMO-0041 et document AV-DEMO-0007",
      note: "Le taux de 20 % illustre l’article 99-A seulement si l’opération n’est pas au 99-B. Les numéros sont fictifs : le CGI ne fixe pas le préfixe.",
      rows: [
        { label: "Facture", value: "10 × 150,00 = 1 500,00 HT", annotation: "TVA 300,00. Total 1 800,00. Numéro conservé." },
        { label: "Correction", value: "2 × 150,00 = 300,00 HT", annotation: "TVA 60,00. Total 360,00. Autre numéro." },
        { label: "Net", value: "1 440,00 TTC", annotation: "1 800,00 − 360,00, soit 8 bidons." },
      ],
    },
    p("Contrôle : 1 500,00 − 300,00 = 1 200,00 ; 300,00 − 60,00 = 240,00 ; 1 200,00 + 240,00 = 1 440,00. Les deux pièces restent."),
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Le champ de l’article 145 dépend du régime. Le taux dépend de l’opération : 20 % à l’article 99-A, 10 % au 99-B, ou une exonération. Qualifier le document et le porter sur la déclaration de taxe relève de votre dossier.",
      ]],
    },
    h2("erreurs-frequentes", "Erreurs fréquentes"),
    p("Réutiliser le numéro, jeter l’original, ou recopier le taux de 20 % de l’exemple sur une autre opération. Confondre l’archivage avec un envoi à l’administration. Le parcours PDF et XML est sur ",
      { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
      ". Si la vente vit aussi dans un second fichier, voir ",
      { href: "/blog/erp-maroc-pme", label: "ERP au Maroc" },
      "."),
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "Dans ESSENTIEL, l’avoir client est un autre document : il ne reprend pas le numéro de la facture. Le détail est sur ",
        { href: "/logiciel-facturation-maroc", label: "le logiciel de facturation au Maroc" },
        ".",
      ], [
        "Après activation, le PDF, le XML et l’archivage couvrent les factures et les avoirs clients. Felexia est prêt pour la facture électronique : le logiciel produit des factures en PDF et en XML et les archive. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Les fonctions seront mises à jour à la publication des textes.",
      ]],
    },
  ],
  questions: [
    {
      question: "Peut-on supprimer une facture pour corriger une erreur de quantité ?",
      answer: "L’article 145-III, édition 2026, demande une série continue. Retirer un numéro déjà émis ouvre un trou. La pratique qui garde la suite consiste à laisser la facture en place et à constater la correction sur un autre document, conservé avec elle.",
    },
    {
      question: "L’avoir doit-il reprendre le numéro de la facture ?",
      answer: "Non, si l’on veut éviter deux contenus pour un seul numéro. La facture garde son numéro. Le document de correction a le sien, dans une série continue. L’édition 2026 ne dit pas si cette série est celle des factures ou une série distincte.",
    },
    {
      question: "Le CGI impose-t-il un modèle d’avoir ?",
      answer: "L’édition 2026 ne définit pas le mot « avoir » et ne fixe pas de modèle de facture rectificative. Si le document est lui-même une facture ou un mémoire, l’article 145-III lui demande une série continue et les mentions. Le classement du document se valide avec l’expert-comptable.",
    },
    {
      question: "Une remise après facturation modifie-t-elle la taxe déclarée ?",
      answer: "L’article 151 demande de déclarer les rabais, remises et ristournes accordés après facturation, avec d’autres sommes allouées à des tiers. Il ne décrit pas une case de taxe. L’article 96 définit le chiffre d’affaires imposable hors taxe, sans ligne d’avoir. La déclaration se confirme avec l’expert-comptable.",
    },
    {
      question: "Felexia envoie-t-il l’avoir à la DGI ?",
      answer: "Non. Le parcours couvre le PDF, le XML, l’émission et l’archivage des factures et des avoirs clients, après activation par l’administrateur. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée.",
    },
  ],
  cta: {
    label: `Essayer Felexia ${offer.trial}, sans carte bancaire`,
    href: "/login?mode=register",
    note: offer.offerPitch,
  },
  related: [
    { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation au Maroc" },
    { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
    { href: "/blog/erp-maroc-pme", label: "ERP au Maroc : à quoi ça sert" },
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
    { href: "/blog/modele-facture-maroc-ice", label: "Modèle de facture avec ICE" },
    { href: "/blog/ice-facture-maroc", label: "ICE sur la facture" },
    { href: "/blog/facture-auto-entrepreneur-maroc", label: "Facture d’auto-entrepreneur" },
  ],
  sources: [
    { label: "Direction générale des impôts — Code général des impôts, édition 2026 (fichier « CGI 2026 FR.pdf » sur tax.gov.ma). Préambule : loi de finances n° 50-25, Bulletin officiel n° 7465 bis du 16 décembre 2025. Articles 96, 99-A, 99-B, 119, 145 (I, III, IX, X, XI), 151 et 211.", href: "https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES", consulted },
    { label: "Felexia — page Logiciel de facturation au Maroc : factures, avoirs et règlements", href: "/logiciel-facturation-maroc", consulted },
    { label: "Felexia — page Facture électronique au Maroc : PDF et XML des factures et avoirs clients, sans connexion officielle à la DGI", href: "/facturation-electronique-maroc", consulted },
    { label: "Felexia — page ESSENTIEL : avoirs clients et fournisseurs, essai et tarif affiché", href: "/essentiel", consulted },
    { label: "Felexia — page Tarifs : 99 MAD HT par mois, 1 188 MAD HT par an, essai de 15 jours sans carte bancaire", href: "/pricing", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les règles évoluent : vérifiez auprès de l’administration fiscale ou de votre expert-comptable. Mis à jour le 17 novembre 2026.",
};

export default article;
