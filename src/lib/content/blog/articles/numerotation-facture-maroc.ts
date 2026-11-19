import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "18/11/2026";

const article: BlogArticle = {
  slug: "numerotation-facture-maroc",
  path: "/blog/numerotation-facture-maroc",
  title: "Numérotation facture Maroc : la série continue | Felexia",
  description: "Numérotation facture Maroc : ce que l’article 145-III demande pour une série continue, et comment corriger une erreur sans réutiliser le numéro.",
  h1: "Numérotation facture Maroc : série continue et trous",
  category: "facturation",
  publishedAt: "2026-11-18",
  updatedAt: "2026-11-18",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-numerotation-facture-maroc.webp",
    avif: "/images/blog/blog-numerotation-facture-maroc.avif",
    alt: "Illustration d’une série de factures en éventail, reliées par une ligne pointillée, aux couleurs bleu et menthe.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "L’article 145-III, édition 2026, demande une série continue : facture pré-numérotée, ou éditée par un système informatique selon cette série.",
    "Le numéro est dans le chapeau du paragraphe, pas dans la liste des mentions. Le préfixe, l’année et le nombre de chiffres ne sont pas fixés.",
    "L’article 211 demande dix ans de conservation des doubles, au lieu où l’entreprise est imposée. Le 145-VI prévoit un autre délai, pour le résultat net simplifié.",
    "L’édition 2026 ne chiffre pas d’amende pour un trou. L’article 191-I vise le défaut de présentation des pièces. L’article 192-I vise d’autres faits.",
  ],
  introduction: [
    "La numérotation d’une facture au Maroc suit une série continue. ",
    "L’article 145-III du Code général des impôts, édition 2026, demande des factures ou mémoires pré-numérotés, tirés d’une série continue, ou édités par un système informatique selon une série continue. Un numéro sauté, ou deux contenus sous le même numéro, casse cette suite. Le code ne fixe ni le préfixe, ni un montant d’amende pour ce seul écart. Les mentions de la pièce sont dans la ",
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "checklist de l’article 145" },
    ", et un exemple annoté est dans le ",
    { href: "/blog/modele-facture-maroc-ice", label: "modèle de facture avec ICE" },
    ".",
  ],
  blocks: [
    h2("serie", "Numérotation facture Maroc : la série continue"),
    p("L’article 145 est intitulé « Tenue de la comptabilité ». Son III, sous réserve du IX, oblige à délivrer aux acheteurs ou clients des factures ou mémoires pré-numérotés, tirés d’une série continue, ou édités par un système informatique selon une série continue. Les deux formules demandent la continuité. Le support change. La suite, non. Cela s’ajoute aux « indications habituelles d’ordre commercial », formule que l’édition 2026 ne définit pas."),
    h3("mentions", "Le numéro n’est pas une ligne de la liste"),
    p("Les points 1° à 8° listent l’identité du vendeur, l’identifiant fiscal et la taxe professionnelle, la date, le client et son identifiant commun de l’entreprise, la nature, la quantité et le prix, la taxe distincte, le paiement, puis les autres renseignements prescrits par la loi. « Numéro de facture » n’y est pas une ligne : il est dans le chapeau. Le ticket de caisse, possible pour une vente de produits à des particuliers, ne reprend pas cette série dans la liste lue."),
    h3("informatique", "Le paragraphe IX ne réécrit pas la suite"),
    p("Le IX vise l’impôt sur les sociétés, le revenu professionnel au réel ou au simplifié, et les assujettis à la TVA. Ils doivent se doter d’un système informatique de facturation répondant aux critères techniques de l’administration, conformément aux III et IV. Les modalités sont renvoyées à un texte réglementaire, par secteur. La note de l’édition 2026 renvoie à la loi de finances n° 68-17. Le IX ne définit pas le format du numéro, ni une date, ni un portail."),
    p("L’article 7 de la loi de finances n° 50-25, publié au Bulletin officiel n° 7465 bis du 16 décembre 2025, modifie l’article 145. L’extrait publié réécrit le I, sur la comptabilité électronique, le X, sur l’adresse électronique, et la réserve du XI. Il ne réécrit pas la phrase de la série continue. Le XI écarte l’article 145 pour la contribution professionnelle unique et l’auto-entrepreneur, sauf l’adresse électronique du X."),
    h2("ouvert", "Ce que l’édition 2026 ne fixe pas"),
    p("Le chapeau dit « une série continue ». Il ne dit pas comment écrire le numéro : pas de préfixe, pas de nombre de chiffres, pas d’année obligatoire. Le mot « trou » n’y figure pas. Un écart, c’est une lecture de la suite : 18, puis 20, sans le 19."),
    p("L’édition ne dit pas si une série par établissement, par caisse ou par année est admise. Elle ne dit pas si un avoir partage la série des factures. Ces classements se valident avec l’expert-comptable. Un saut inexpliqué dans la série que vous utilisez n’est plus une série continue. Ouvrir une série nouvelle au changement d’année n’est ni permis ni interdit par une phrase du III : le texte ne décrit pas ce geste."),
    h2("erreurs", "Erreurs à éviter"),
    p("Les lignes ci-dessous ne sont pas des infractions nommées par le CGI. Ce sont des écarts de suite, et la pratique qui la garde lisible. Le texte officiel demande la continuité. Il ne décrit pas le fichier, le PDF ni le motif à conserver."),
    {
      type: "table",
      caption: "Écarts de numéro : effet sur la suite, et pratique qui la garde lisible",
      columns: ["Écart", "Effet sur la suite", "Pratique"],
      rows: [
        ["Réécrire le PDF", "Deux contenus pour un numéro", "Laisser le numéro déjà émis"],
        ["Retirer une pièce numérotée", "Un trou dans la série", "Garder la pièce et le motif"],
        ["Réutiliser le numéro", "Deux opérations, un numéro", "Prendre le numéro suivant"],
        ["Sauter sans motif", "La suite n’est plus lisible", "Noter pourquoi le numéro manque"],
      ],
    },
    p("Le III vise les factures et les mémoires. Un devis n’en est pas un. La facture reçoit le numéro de sa série. Le lien avec le devis se fait par une référence, pas par le même numéro."),
    h2("exemple-fictif", "Exemple fictif : deux jarres de trop"),
    p("L’Atelier des Oliviers et la Maison du Safran n’existent pas. Les adresses non plus. L’ICE de démonstration est 000000000000000. FAC-DEMO-0018 est déjà dans le dossier : on n’y touche pas. FAC-DEMO-0019 compte 6 jarres. La livraison en comptait 4. On ne réécrit pas 0019."),
    {
      type: "example",
      kicker: "Exemple fictif",
      title: "Facture FAC-DEMO-0019 et document AV-DEMO-0004",
      note: "Noms et numéros fictifs. Le taux de 20 % illustre l’article 99-A seulement si l’opération n’est pas au 99-B. Le CGI ne fixe pas les préfixes.",
      rows: [
        { label: "Vendeur", value: "Atelier des Oliviers, Casablanca", annotation: "Société fictive. ICE 000000000000000." },
        { label: "Client", value: "Maison du Safran, Marrakech", annotation: "Client fictif. Même ICE de démonstration." },
        { label: "Facture", value: "6 × 125,00 = 750,00 HT", annotation: "FAC-DEMO-0019. TVA 150,00. Total 900,00." },
        { label: "Correction", value: "2 × 125,00 = 250,00 HT", annotation: "AV-DEMO-0004. TVA 50,00. Total 300,00." },
        { label: "Net", value: "600,00 TTC", annotation: "900,00 − 300,00. Quatre jarres. Numéro 0019 conservé." },
      ],
    },
    p("Contrôle : 750,00 + 150,00 = 900,00 ; 250,00 + 50,00 = 300,00 ; 900,00 − 300,00 = 600,00. Hors taxe, 500,00, soit 4 × 125,00. Réécrire ou supprimer 0019 casserait la suite. La vente d’après est FAC-DEMO-0020. L’édition 2026 ne dit pas si l’avoir partage cette série."),
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Le champ de l’article 145 dépend du régime. Le XI écarte la contribution professionnelle unique et l’auto-entrepreneur, sauf l’adresse électronique. Le taux dépend de l’opération : 20 % à l’article 99-A, 10 % pour les opérations listées au 99-B, ou une exonération des articles 91, 92 ou 94. Qualifier la série, l’avoir et la déclaration relève de votre dossier.",
      ]],
    },
    h2("conservation", "Conserver les doubles dix ans"),
    p("L’article 211 demande dix ans de conservation, au lieu où le contribuable est imposé, pour les doubles des factures de vente ou des tickets de caisse, les pièces de dépenses et d’investissements, et les documents comptables nécessaires au contrôle. Le numéro sans la pièce ne remplace pas le double."),
    h3("deux-delais", "Deux délais, deux textes"),
    p("Le 145-VI vise le résultat net simplifié. Pour les factures délivrées à certains clients professionnels, il demande des pièces selon le III, et la conservation des doubles pendant les dix années suivant celle de leur établissement. Ce n’est pas la phrase de l’article 211. L’un est général. L’autre est lié à ce régime et à ces destinataires."),
    p("Quand la comptabilité est électronique, l’article 211 demande ces documents sur support électronique, dans les cas qu’il vise avec les articles 210 et 145-I. Une perte s’indique à l’inspecteur par lettre recommandée avec accusé de réception, sous quinze jours, ou trente en cas de force majeure."),
    h2("sanctions", "Sanctions : ce qui est écrit, et ce qui ne l’est pas"),
    p("L’article 191-I et l’article 192-I chiffrent des sanctions. Ils ne fixent pas de montant pour un trou, ni pour deux contenus sous un même numéro."),
    h3("presentation", "Ne pas présenter les pièces"),
    p("L’article 191-I prévoit 2 000 dirhams et, le cas échéant, 100 dirhams par jour de retard, dans la limite de 1 000 dirhams. Il vise qui ne présente pas les documents comptables et les pièces des articles 145 et 146, ou qui refuse le contrôle de l’article 212, dans les conditions de l’article 229. En impôt sur le revenu, cette amende varie de 500 à 2 000 dirhams. C’est une sanction de présentation. Ce n’est pas une amende par numéro sauté."),
    h3("penal", "Factures fictives et ventes sans facture"),
    p("L’article 192-I est pénal, indépendant des sanctions fiscales. Il vise qui, pour se soustraire à l’impôt ou obtenir une déduction ou un remboursement indu, utilise un moyen qu’il énumère. Parmi eux : factures fictives, écritures fausses ou fictives, vente sans factures de manière répétitive, soustraction ou destruction de pièces comptables exigibles. L’amende va de 5 000 à 50 000 dirhams, avec un emprisonnement d’un à trois mois. L’application suit l’article 231. Un trou n’y figure pas."),
    p("Pour l’acheteur, l’article 146 demande une facture régulière et probante, au nom de l’intéressé, avec les indications des 145-III et VIII. Il refuse la déduction dans les cas qu’il décrit, dont le fournisseur défaillant après jugement définitif et l’entreprise inactive du 228 bis. Il ne dit pas qu’un trou chez le vendeur retire, à lui seul, cette déduction."),
    h2("correction", "Corriger sans réutiliser le numéro"),
    p("Une erreur de quantité ne se règle pas en rouvrant le PDF. La facture garde son numéro. La correction en prend un autre. Les deux restent au dossier. Ce que l’édition 2026 ne définit pas sous le mot « avoir » est dans ",
      { href: "/blog/avoir-facture-maroc", label: "Avoir ou annulation" },
      ". Le numéro suivant sert à la prochaine facture. Le III ne décrit pas le redémarrage annuel : il décrit la continuité de la série en cours."),
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "Dans ESSENTIEL, vous établissez les factures de vente et les avoirs. La numérotation se configure pour apparaître sur le PDF, avec le logo, les coordonnées et l’ICE renseignés. L’avoir reste un autre document : il corrige une facture déjà émise sans effacer le lien avec la pièce d’origine. Le détail est sur ",
        { href: "/logiciel-facturation-maroc", label: "le logiciel de facturation au Maroc" },
        ".",
      ], [
        "Après activation par l’administrateur, le PDF, le XML et l’archivage couvrent les factures et les avoirs clients. Felexia est prêt pour la facture électronique : le logiciel produit des factures en PDF et en XML et les archive. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Les fonctions seront mises à jour à la publication des textes. Le parcours est sur ",
        { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
        ".",
      ]],
    },
  ],
  questions: [
    {
      question: "La numérotation d’une facture au Maroc doit-elle être continue ?",
      answer: "Oui, pour les factures et mémoires visés par l’article 145-III, édition 2026. Le chapeau demande des pièces pré-numérotées, tirées d’une série continue, ou éditées par un système informatique selon une série continue. Le paragraphe XI écarte l’article 145 pour la contribution professionnelle unique et l’auto-entrepreneur, sauf l’adresse électronique.",
    },
    {
      question: "Le CGI fixe-t-il le format du numéro ?",
      answer: "Non. L’édition 2026 ne fixe ni le préfixe, ni le nombre de chiffres, ni la présence de l’année. Elle ne dit pas si une série par établissement, par caisse ou par année est admise. Elle demande une série continue. Le format se choisit, puis se tient, avec l’expert-comptable.",
    },
    {
      question: "Un trou dans la série a-t-il une amende précise ?",
      answer: "L’édition 2026 ne chiffre pas de montant pour un numéro manquant, ni pour deux contenus sous un même numéro. L’article 191-I sanctionne le défaut de présentation des pièces des articles 145 et 146, ou le refus de contrôle : 2 000 dirhams, et le cas échéant 100 dirhams par jour dans la limite de 1 000, avec une fourchette de 500 à 2 000 dirhams en impôt sur le revenu. L’article 192-I vise d’autres faits, dont les factures fictives et les ventes répétées sans facture. Un trou n’est pas dans cette liste.",
    },
    {
      question: "Peut-on réutiliser un numéro après une erreur de quantité ?",
      answer: "Le réutiliser donne deux contenus, ou deux opérations, pour un seul numéro. La pratique qui garde la série continue consiste à laisser la facture en place et à constater la correction sur un autre document, avec son propre numéro. L’édition 2026 ne dit pas si ce second numéro appartient à la série des factures.",
    },
    {
      question: "Combien de temps conserve-t-on le double de la facture ?",
      answer: "L’article 211 demande dix ans, au lieu où le contribuable est imposé, pour les doubles des factures de vente ou des tickets de caisse et pour les pièces nécessaires au contrôle. Le 145-VI, pour le résultat net simplifié et certains clients professionnels, demande les dix années suivant celle de l’établissement. Les deux textes se lisent ensemble. Ils ne se remplacent pas.",
    },
    {
      question: "Felexia transmet-il la numérotation à la DGI ?",
      answer: "Non. Le parcours couvre le PDF, le XML, l’émission et l’archivage des factures et des avoirs clients, après activation par l’administrateur. Felexia est prêt pour la facture électronique au sens de ce parcours. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée.",
    },
  ],
  cta: {
    label: `Essayer Felexia ${offer.trial}, sans carte bancaire`,
    href: "/login?mode=register",
    note: offer.offerPitch,
  },
  related: [
    { href: "/blog/declaration-tva-export-simpl", label: "Déclaration de TVA et export SIMPL-TVA" },
    { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation au Maroc" },
    { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
    { href: "/blog/avoir-facture-maroc", label: "Avoir ou annulation d’une facture" },
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
    { href: "/blog/modele-facture-maroc-ice", label: "Modèle de facture avec ICE" },
  ],
  sources: [
    { label: "Direction générale des impôts — Code général des impôts, édition 2026 (fichier « CGI 2026 FR.pdf » sur tax.gov.ma). Préambule : loi de finances n° 50-25, dahir n° 1-25-67 du 10 décembre 2025, Bulletin officiel n° 7465 bis du 16 décembre 2025. Articles 91, 92, 94, 99-A, 99-B, 145 (I, III, VI, VIII, IX, X, XI), 146, 191-I, 192-I, 211 et 212.", href: "https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES", consulted },
    { label: "Secrétariat général du gouvernement — Bulletin officiel, édition de traduction officielle, n° 7465 bis du 25 joumada II 1447 (16 décembre 2025). Dahir n° 1-25-67 du 10 décembre 2025 portant promulgation de la loi de finances n° 50-25. Article 7 : modification, à compter du 1er janvier 2026, des articles 99 et 145 du CGI. L’extrait publié de l’article 145 réécrit les paragraphes I, X et XI. Il ne réécrit pas la série continue du III. L’extrait de l’article 99 maintient 20 % et 10 %.", href: "https://www.sgg.gov.ma/BO/FR/2873/2025/BO_7465-bis_fr.pdf", consulted },
    { label: "Felexia — page Logiciel de facturation au Maroc : factures, avoirs et règlements", href: "/logiciel-facturation-maroc", consulted },
    { label: "Felexia — page Facture électronique au Maroc : PDF et XML des factures et avoirs clients, sans connexion officielle à la DGI", href: "/facturation-electronique-maroc", consulted },
    { label: "Felexia — page Tarifs, consultée le 18/11/2026 : 99 MAD HT par mois, 1 188 MAD HT par an, essai de 15 jours sans carte bancaire", href: "/pricing", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les règles évoluent : vérifiez auprès de l’administration fiscale ou de votre expert-comptable. Mis à jour le 18 novembre 2026.",
};

export default article;
