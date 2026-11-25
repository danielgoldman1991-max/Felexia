import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "20/11/2026";

const article: BlogArticle = {
  slug: "facture-electronique-questions-editeur-logiciel",
  path: "/blog/facture-electronique-questions-editeur-logiciel",
  title: "Logiciel facture électronique : 5 questions | Felexia",
  description: "Logiciel facture électronique au Maroc : questions à poser à l’éditeur, et ce que l’article 145 du CGI ne fixe ni en date, ni en seuil, ni en format.",
  h1: "Facture électronique : les 5 questions à poser à votre éditeur de logiciel",
  category: "facture-electronique",
  publishedAt: "2026-11-20",
  updatedAt: "2026-11-20",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-facture-electronique-questions-editeur-logiciel.webp",
    avif: "/images/blog/blog-facture-electronique-questions-editeur-logiciel.avif",
    alt: "Illustration d’une facture transformée en données, analysée à la loupe avec une check-list, en bleu et menthe",
    width: 1600,
    height: 900,
  },
  essentials: [
    "Cinq questions suffisent pour comparer un logiciel : ce qu’il produit aujourd’hui, ce qu’il archive, et s’il envoie quelque chose à l’administration.",
    "L’article 145-IX du CGI, édition 2026, demande un système informatique de facturation à certains contribuables. Les modalités sont renvoyées à un règlement, par secteur. Ce paragraphe ne fixe ni date, ni seuil, ni format, ni sanction.",
    "L’édition 2026 n’emploie pas les mots « facture électronique » ni « facturation électronique ». Le 20 novembre 2026, les sommaires indexés du Bulletin officiel ne renvoient aucun texte pour ces expressions, ni pour « système informatique de facturation ».",
    "« Prêt pour la facture électronique » signifie un PDF, un XML et une archive. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée.",
  ],
  introduction: [
    "Un logiciel de facture électronique au Maroc se juge à ses réponses, pas à un slogan. Au 20 novembre 2026, le principe d’un système informatique de facturation est écrit à l’article 145-IX du Code général des impôts. Le calendrier, les seuils, le format et les sanctions propres à ce paragraphe ne le sont pas. ",
    "Ce guide vous donne cinq questions à poser à l’éditeur, ce qu’il faut entendre, et le signal d’alerte. L’état des textes est dans ",
    { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Facture électronique au Maroc : où en est-on ?" },
    ". La différence entre une page et un fichier de données est dans ",
    { href: "/blog/facture-electronique-pdf-xml", label: "PDF, XML et facture électronique" },
    ".",
  ],
  blocks: [
    h2("pourquoi-ces-questions", "Pourquoi poser ces questions avant de choisir"),
    p("Vous signez pour des fonctions, pas pour un calendrier qui n’est pas publié. Le décret d’application de l’article 145-IX n’est pas dans les sommaires consultés le 20 novembre 2026. Demandez ce que le logiciel fait aujourd’hui : une page, un fichier de données, une archive, un envoi. Demandez séparément ce qui attendra un règlement."),
    p("Le quotidien, clients, factures et règlements, se juge à part. Les critères plus larges sont dans ",
      { href: "/blog/logiciel-gestion-pme-maroc", label: "Logiciel de gestion pour PME au Maroc : 10 critères" },
      "."),
    h2("article-145", "Que fixe l’article 145, et que reste-t-il ouvert ?"),
    p("L’article 145, « Tenue de la comptabilité », vise au IX les contribuables à l’impôt sur les sociétés, à l’impôt sur le revenu professionnel au réel ou au simplifié, et les assujettis à la TVA. Ils doivent se doter d’un système informatique de facturation aux critères techniques de l’administration, conformément aux III et IV. Les modalités sont fixées par voie réglementaire, par secteur. La note 1064 renvoie à l’article 8 de la loi de finances n° 68-17 pour 2018."),
    p("Ce paragraphe ne nomme ni portail, ni date, ni seuil, ni format, ni sanction. L’édition 2026, lue le 20 novembre 2026 dans « CGI 2026 FR.pdf » sur tax.gov.ma, ne contient pas « facture électronique » ni « facturation électronique »."),
    p("En vigueur à côté : la série continue et les mentions du III, l’ICE du vendeur au VIII, l’adresse électronique du X. Le XI écarte l’article 145 pour la contribution professionnelle unique et l’auto-entrepreneur, sauf cette adresse. L’article 211 demande de conserver dix ans les doubles des factures de vente, sur support électronique lorsque le 145-I s’applique. Le détail des mentions est dans ",
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
      "."),
    p("Le 20 novembre 2026, la recherche des sommaires indexés sur sgg.gov.ma, du 1er janvier 2018 à cette date, ne renvoie aucun texte pour les expressions exactes « facturation électronique », « facture électronique » et « système informatique de facturation ». Une recherche de contrôle sur « code général des impôts » renvoie des textes, dont le Bulletin officiel n° 7465 bis du 16 décembre 2025. Le sommaire le plus récent renvoyé ce jour-là, sur une recherche « dahir » en octobre 2026, est le n° 7554 bis du 22 octobre 2026. La recherche porte sur les sommaires indexés."),
    h2("cinq-questions", "Quelles questions poser sur un logiciel de facture électronique au Maroc ?"),
    p("Posez les cinq questions dans cet ordre. La première porte sur le fichier. La dernière porte sur ce qui n’est pas encore écrit. Le tableau dit ce qu’une réponse utile contient, et le signal qui doit vous faire reposer la question."),
    {
      type: "table",
      caption: "Grille des cinq questions, lue au 20 novembre 2026",
      columns: ["Question", "Ce qu’il faut entendre", "Signal d’alerte"],
      rows: [
        [
          "Que produit le logiciel aujourd’hui ?",
          "Une page PDF pour le client, et un fichier de données où le client, la taxe et le total sont des champs séparés. Les deux peuvent exister sans être un envoi.",
          "Appeler facture électronique tout PDF envoyé par e-mail, ou présenter un format comme imposé alors que le 145-IX n’en nomme aucun.",
        ],
        [
          "Le fichier part-il vers l’administration ?",
          "Une distinction nette entre produire le fichier et le transmettre. Aucun sommaire indexé ce jour-là ne fixe de portail ni de date.",
          "Une promesse de connexion officielle à la DGI, ou une date d’obligation, alors qu’aucun texte lu ne la fixe.",
        ],
        [
          "Les mentions du III et l’ICE du VIII y sont-ils ?",
          "Série continue, vendeur, identifiant fiscal, taxe professionnelle, date, client et son ICE, nature, quantité, prix, taxe distincte, mode de paiement, ICE du vendeur.",
          "Un ICE seulement dans un pied de page, ou une série qui accepte des trous sans trace.",
        ],
        [
          "Que devient la version émise ?",
          "Une archive de la version retenue, une impression servie depuis cette archive, et la conservation de dix ans des doubles prévue à l’article 211.",
          "Un essai de génération confondu avec la pièce émise, ou un PDF qui n’existe que sur un seul poste.",
        ],
        [
          "Que changera le logiciel quand un règlement sera publié ?",
          "L’éditeur dit ce qu’il mettra à jour à la publication des textes, sans inventer le calendrier, le seuil ou le format.",
          "Un calendrier, un seuil ou une sanction présentés comme déjà décidés, alors que le IX renvoie ces modalités à un règlement absent des sommaires consultés.",
        ],
      ],
    },
    h3("fichier-et-envoi", "Fichier produit et fichier envoyé"),
    p("Un PDF fige la page. Un fichier de données, souvent en XML, range le client, la taxe et le total dans des champs. Ni la page ni le fichier n’est, par sa seule forme, un envoi à l’administration. Au 20 novembre 2026, l’article 145-IX ne décrit pas ce circuit. Générer un XML n’est pas une date d’obligation."),
    h3("mentions-et-archive", "Mentions, archive et suite"),
    p("La série, les mentions du III et l’ICE du VIII sont déjà dans le code. Demandez où l’ICE du vendeur est saisi, sur la page et dans un champ. Une archive n’est pas un brouillon : l’impression d’une pièce émise sort de la version retenue. L’article 211 fixe dix ans pour les doubles. Il ne crée pas un portail. La dernière réponse est une mise à jour future, pas un calendrier."),
    h2("exemple-fictif", "Exemple fictif : les cinq questions sur une même vente"),
    p("La Menuiserie des Oliviers, à Marrakech, n’existe pas. Quatre portes à 750,00 dirhams hors taxe font 3 000,00. La taxe à 20 %, taux de l’article 99-A si l’opération n’est pas au 99-B, fait 600,00. Le total fait 3 600,00. L’ICE de démonstration est 000000000000000."),
    {
      type: "example",
      kicker: "Exemple fictif",
      title: "Une vente, cinq vérifications",
      note: "Les noms de champs sont une illustration. Ils ne sont pas un format imposé.",
      rows: [
        { label: "Vente", value: "4 portes × 750,00 MAD hors taxe", annotation: "4 × 750,00 = 3 000,00. Société et client fictifs." },
        { label: "Taxe et total", value: "600,00 de taxe, total 3 600,00 MAD", annotation: "Article 99-A à 20 %, si l’opération n’est pas au 99-B. 3 000,00 + 600,00 = 3 600,00." },
        { label: "ICE", value: "000000000000000", annotation: "145-VIII. Démonstration, pas un identifiant réel." },
        { label: "Page PDF", value: "La vente est lisible sur la page", annotation: "Question 1. La page ne sépare pas, à elle seule, les champs." },
        { label: "Fichier de données", value: "Quantité, hors taxe, taxe et total dans des champs", annotation: "Question 1. Illustration. Pas un schéma officiel." },
        { label: "Envoi", value: "Aucun", annotation: "Question 2. Produire le fichier n’est pas le transmettre." },
        { label: "Archive", value: "Version retenue conservée à part de l’essai", annotation: "Question 4. L’article 211 vise les doubles, dix ans." },
      ],
    },
    h2("erreurs-frequentes", "Erreurs fréquentes"),
    p("Prendre une date dite par un éditeur pour une échéance : l’article 145-IX n’en contient pas, et les sommaires du 20 novembre 2026 n’en montrent pas. Tenir un PDF envoyé au client pour une transmission. Accepter un format comme déjà imposé. Oublier la série et les mentions, déjà dues, en attendant le règlement. Confondre un essai de fichier avec la pièce émise. Étendre le IX aux régimes que le XI écarte, sous réserve de l’adresse du X."),
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Le 145-IX dépend du régime. Le XI écarte la contribution professionnelle unique et l’auto-entrepreneur, sauf l’adresse électronique du X. Le taux de 20 % de l’exemple est celui de l’article 99-A, pas celui des opérations listées au 99-B. La conservation de dix ans de l’article 211 se lit avec votre situation. Le règlement, quand il paraîtra, pourra préciser le secteur.",
      ]],
    },
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "Depuis les factures et avoirs clients validés, ESSENTIEL et PRO génèrent un PDF et un XML, puis l’émission et l’archivage, après activation par l’administrateur depuis Ventes, Facturation électronique, Configuration. Felexia est prêt pour la facture électronique : le logiciel produit des factures en PDF et en XML et les archive. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Les fonctions seront mises à jour à la publication des textes. Voir ",
        { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
        " et ",
        { href: "/logiciel-facturation-maroc", label: "le logiciel de facturation" },
        ".",
      ], [
        offer.offerPitch,
      ]],
    },
  ],
  questions: [
    {
      question: "La facture électronique est-elle déjà obligatoire à une date précise ?",
      answer: "L’article 145-IX du CGI, édition 2026, demande un système informatique de facturation aux régimes qu’il vise, et renvoie les modalités à un règlement, par secteur. Il ne fixe ni date, ni seuil, ni format, ni sanction. Le 20 novembre 2026, les sommaires indexés du Bulletin officiel ne renvoient aucun texte pour « facture électronique », « facturation électronique » ni « système informatique de facturation ».",
    },
    {
      question: "Un logiciel peut-il imposer un format au nom de la DGI ?",
      answer: "Non, au sens d’un texte publié. L’article 145-IX ne nomme aucun format. L’édition 2026 du CGI n’emploie pas les mots « facture électronique ». Un fichier, PDF ou XML, peut exister sans être le format d’un règlement qui n’est pas dans les sommaires consultés.",
    },
    {
      question: "Que vérifier tout de suite sur les factures ?",
      answer: "La série continue et les mentions de l’article 145-III, l’ICE du vendeur au VIII, et l’adresse électronique du X lorsque ce paragraphe s’applique. Ces points sont déjà dans le code. Ils ne dépendent pas du décret d’application du IX.",
    },
    {
      question: "Felexia envoie-t-il le fichier à la DGI ?",
      answer: "Non. Felexia est prêt pour la facture électronique au sens du PDF, du XML et de l’archivage, après activation par l’administrateur. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Le XML généré ne constitue pas une acceptation fiscale. Les fonctions seront mises à jour à la publication des textes.",
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
    { href: "/blog/facture-electronique-pdf-xml", label: "PDF, XML et facture électronique" },
    { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Où en est la facture électronique" },
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
    { href: "/blog/logiciel-gestion-pme-maroc", label: "10 critères pour choisir un logiciel de gestion" },
  ],
  sources: [
    { label: "Direction générale des impôts — Code général des impôts, édition 2026 (fichier « CGI 2026 FR.pdf » sur tax.gov.ma, édition listée au 30 décembre 2025). Préambule : loi de finances n° 50-25, Bulletin officiel n° 7465 bis. Articles 99-A, 99-B, 145 (I, III, VIII, IX, X, XI), notes 1055, 1063, 1064, 1065, 1066, 1067 et 1068, et article 211. Les expressions « facture électronique » et « facturation électronique » n’y figurent pas.", href: "https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES", consulted },
    { label: "Direction générale des impôts — page Documentation fiscale, rubrique Code général des impôts, édition 2026 indiquée au 30 décembre 2025.", href: "https://www.tax.gov.ma/wps/portal/DGI/Documentation-fiscale/Arretes", consulted },
    { label: "Secrétariat général du gouvernement — recherche des sommaires du Bulletin officiel, expressions exactes « facturation électronique », « facture électronique » et « système informatique de facturation », du 1er janvier 2018 au 20 novembre 2026. Aucun texte renvoyé. Recherche de contrôle « code général des impôts » : des textes, dont le Bulletin officiel n° 7465 bis du 16 décembre 2025. Sommaire le plus récent renvoyé le même jour sur « dahir » en octobre 2026 : n° 7554 bis du 22 octobre 2026. Recherche limitée aux sommaires indexés.", href: "https://www.sgg.gov.ma/Legislation/rechercheSommairesBO.aspx", consulted },
    { label: "Felexia — page Facture électronique au Maroc : PDF, XML, émission, archivage, activation par l’administrateur, absence de connexion officielle à la DGI.", href: "/facturation-electronique-maroc", consulted },
    { label: "Felexia — page Tarifs : prix ESSENTIEL, essai de 15 jours et inclusion du parcours documentaire. PRO sur devis.", href: "/pricing", consulted },
    { label: "Felexia — page Logiciel de facturation au Maroc, pour le périmètre du quotidien cité dans l’encadré.", href: "/logiciel-facturation-maroc", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les règles évoluent : vérifiez auprès de l’administration fiscale ou de votre expert-comptable. Mis à jour le 20 novembre 2026.",
};

export default article;
