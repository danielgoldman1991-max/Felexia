import { publicOfferCopy } from "@/lib/content/blog/offers";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { bullets, h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const essential = getPlanDefinition("essentiel");
const money = (value: number) => value.toLocaleString("fr-FR");
const twelve = money(essential.yearlyPrice);
const thirtySix = money(essential.yearlyPrice * 3);
const consulted = "26/11/2026";

const article: BlogArticle = {
  slug: "prix-logiciel-gestion-maroc",
  path: "/blog/prix-logiciel-gestion-maroc",
  title: "Prix logiciel de gestion Maroc : les coûts | Felexia",
  description: "Le prix d’un logiciel de gestion au Maroc : abonnement, utilisateurs, mise en place et coûts cachés, à comparer sur 12 mois puis sur 36 mois.",
  h1: "Combien coûte un logiciel de gestion au Maroc ? Les postes de coût à comparer",
  category: "choix-logiciel",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-prix-logiciel-gestion-maroc.webp",
    avif: "/images/blog/blog-prix-logiciel-gestion-maroc.avif",
    alt: "Illustration d’une balance : cubes avec pièces, engrenage et liste d’un côté, plateau vide, loupe et silhouette d’une ville.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "Le prix d’un logiciel de gestion se lit poste par poste : abonnement ou licence, utilisateurs, modules, mise en place et reprise, formation, assistance, hébergement, puis le temps, les erreurs et les ressaisies de l’outil actuel.",
    `Sur la page Tarifs du 26 novembre 2026, ESSENTIEL est à ${offer.monthly} MAD HT par mois, ou ${offer.yearly} MAD HT par an, soit douze mois sans remise. L’essai dure ${offer.trial}, sans carte bancaire. PRO n’a pas de prix public.`,
    `Sur 12 mois, retenez le tarif annuel publié : ${twelve} MAD HT. Sur 36 mois, trois fois ce tarif font ${thirtySix} MAD HT. Aucun autre poste Felexia n’est chiffré sur cette page : ne le mettez pas à zéro.`,
    "Felexia édite ce site. Les montants Felexia viennent de la page Tarifs. Un autre tarif ne s’inscrit que s’il est lu le jour même sur la page de l’éditeur, avec le lien et la date.",
  ],
  introduction: [
    "Le prix d’un logiciel de gestion au Maroc n’est pas une seule ligne. Comparez les mêmes postes, sur 12 mois puis sur 36 mois, et notez ce que le tarif n’affiche pas. ",
    `Le seul abonnement chiffré ici est celui de la page `,
    { href: "/pricing", label: "Tarifs" },
    ` au 26 novembre 2026 : ESSENTIEL à ${offer.monthly} MAD HT par mois, ou ${offer.yearly} MAD HT par an, sans remise. PRO est sur devis. `,
    "La grille de choix, avant le prix, est dans ",
    { href: "/blog/logiciel-gestion-pme-maroc", label: "10 critères pour un logiciel de gestion" },
    ". Le passage depuis un tableur est dans ",
    { href: "/blog/facture-excel-ou-logiciel-maroc", label: "Excel ou un logiciel de facturation" },
    ".",
  ],
  blocks: [
    h2("postes", "Quels postes font le prix d’un logiciel de gestion ?"),
    p("Sept lignes suffisent pour une première comparaison. Chacune se remplit avec un montant publié, ou avec la mention « non publié ». Une case vide n’est pas un zéro."),
    h3("abonnement-utilisateurs", "Abonnement, licence et utilisateurs"),
    p("Notez le montant hors taxe, la période (mois ou année) et la remise si elle est écrite. Un prix au mois ne se compare pas tel quel à un prix à l’année : ramenez les deux à 12 mois, puis à 36 mois."),
    p(`Le nombre d’utilisateurs inclus change la note. Si un utilisateur supplémentaire a un prix, recopiez-le. S’il n’est pas publié, écrivez « non publié », pas un montant estimé. Sur la page Tarifs, ESSENTIEL comprend jusqu’à ${offer.users} utilisateurs. Aucun prix par utilisateur en plus n’y figure.`),
    h3("modules-limites", "Modules, documents et stockage"),
    p("Le même mot « logiciel de gestion » couvre des périmètres différents. Demandez ce qui est dans le prix : factures, avoirs, achats, banque, caisse, devis, stock, paie. Puis les plafonds : documents par mois, stockage, nombre d’entreprises."),
    p(`ESSENTIEL, sur les pages Tarifs et ESSENTIEL, couvre les factures de vente, les avoirs, les règlements, les factures d’achat, la banque, la caisse, les journaux et la déclaration de TVA avec l’export XML. Le plafond est de ${offer.documents} documents commerciaux par mois, ${offer.storageGb} Go, et 1 entreprise. Les devis, les commandes et le stock sont dans PRO.`),
    h3("autour-du-prix", "Mise en place, reprise, formation, assistance, hébergement"),
    p("Ces cinq postes font souvent l’écart, et ils sont souvent absents du prix affiché. Pour chacun : montant écrit, ou « sur devis », ou « non publié »."),
    p("L’accueil décrit un import CSV des clients et des fournisseurs, et l’export des factures en PDF ou en CSV. Il ne publie pas de forfait pour reprendre les factures anciennes. La formation n’a pas de montant. L’assistance non plus : un e-mail et WhatsApp sont indiqués, sans délai. L’hébergement n’a pas de ligne à côté de l’abonnement. Pour PRO, la mise en place est sur devis. Le détail des offres est dans ",
      { href: "/blog/choisir-entre-essentiel-et-pro", label: "ESSENTIEL ou PRO" },
      "."),
    h2("methode", "Le prix d’un logiciel de gestion au Maroc, sur 12 et 36 mois"),
    p("La méthode tient en quatre gestes. Relevez chaque poste sur la page de l’éditeur, avec la date. Écartez les postes non chiffrés : ils restent visibles, mais ils n’entrent pas dans l’addition. Additionnez ce qui est chiffré sur 12 mois. Recommencez sur 36 mois, en ne comptant qu’une fois les frais uniques déjà payés."),
    p(`Pour Felexia ESSENTIEL, le seul poste chiffré le 26 novembre 2026 est l’abonnement. La page indique que l’année est douze mois sans remise : ${twelve} MAD HT. Sur 36 mois, trois fois ce tarif annuel font ${thirtySix} MAD HT. Formation, mise en place, assistance et hébergement distinct ne s’ajoutent pas : ils ne sont pas publiés. Ce n’est pas un coût nul.`),
    p(`PRO reste une proposition, sans prix en ligne. Jusqu’à ${offer.proUsers} utilisateurs, des documents commerciaux sans plafond mensuel et ${offer.proStorageGb} Go sont indiqués. Le montant se demande, il ne s’invente pas. Si votre besoin est le stock, les devis ou la paie, la comparaison s’arrête à « sur devis » tant que la proposition n’est pas écrite.`),
    h2("tableau", "Le tableau à remplir avant de choisir"),
    p("La colonne Felexia est remplie avec la page Tarifs du 26 novembre 2026, et avec les pages ESSENTIEL et PRO pour le périmètre. La dernière colonne est la vôtre. N’y mettez un prix concurrent que si vous l’avez lu ce jour-là sur le site de l’éditeur."),
    {
      type: "table",
      caption: "Grille de coût, à compléter. Felexia : page Tarifs du 26 novembre 2026.",
      columns: ["Poste", "Ce qu’il faut noter", "Felexia, publié", "Autre outil"],
      rows: [
        ["Abonnement ou licence", "Montant HT, mois ou année, remise écrite", `${offer.monthly} MAD HT/mois ou ${offer.yearly} MAD HT/an, sans remise`, "À relever, avec la date"],
        ["Utilisateurs", "Nombre inclus, prix d’un utilisateur en plus s’il est publié", `Jusqu’à ${offer.users}. Aucun prix par utilisateur supplémentaire`, "À relever"],
        ["Périmètre dans le prix", "Factures, achats, devis, stock, paie", "Factures, avoirs, règlements, achats, banque, caisse, journaux, déclaration TVA et XML. Devis et stock : PRO", "À relever"],
        ["Plafonds", "Documents, stockage, entreprises", `${offer.documents} documents commerciaux/mois, ${offer.storageGb} Go, 1 entreprise. PRO : sans plafond mensuel, ${offer.proStorageGb} Go, sur devis`, "À relever"],
        ["Mise en place", "Forfait publié ou « sur devis »", "ESSENTIEL : non chiffré. PRO : mise en place sur devis, sans montant", "À relever"],
        ["Reprise des données", "Ce qui s’importe, et le forfait s’il existe", "Import CSV clients et fournisseurs décrit. Pas de forfait publié pour les factures anciennes", "À relever"],
        ["Formation", "Montant ou « incluse » écrit", "Non chiffrée", "À relever"],
        ["Assistance", "Canal, et prix s’il est publié", "E-mail et WhatsApp sur l’accueil, sans tarif ni délai", "À relever"],
        ["Hébergement", "Inclus dans l’abonnement ou facturé à part", "Aucun montant distinct sur la page Tarifs", "À relever"],
        ["Total 12 mois", "Somme des seuls postes chiffrés", `${twelve} MAD HT d’abonnement`, "À calculer"],
        ["Total 36 mois", "Somme des postes chiffrés, frais uniques une seule fois", `${thirtySix} MAD HT d’abonnement`, "À calculer"],
      ],
    },
    h2("exemple-fictif", "Exemple fictif : deux additions, pas un classement"),
    p("Atlas Menuiserie n’existe pas. Son ICE de démonstration est 000000000000000. Elle compare l’abonnement publié de Felexia et un outil B dont tous les montants sont inventés pour l’exemple. L’outil B n’est pas un logiciel du marché."),
    {
      type: "example",
      kicker: "Exemple fictif",
      title: "Atlas Menuiserie, Casablanca",
      note: "Les montants de l’outil B sont inventés. Les montants Felexia sont ceux de la page Tarifs du 26 novembre 2026, abonnement seul.",
      rows: [
        { label: "Société", value: "Atlas Menuiserie", annotation: "Fictive. ICE 000000000000000." },
        { label: "Outil B, licence", value: "240,00 MAD HT / mois", annotation: "Chiffre fictif." },
        { label: "Outil B, hébergement", value: "60,00 MAD HT / mois", annotation: "Chiffre fictif. 240,00 + 60,00 = 300,00." },
        { label: "Outil B, formation", value: "900,00 MAD HT, une fois", annotation: "Chiffre fictif." },
        { label: "Outil B, mise en place", value: "1 500,00 MAD HT, une fois", annotation: "900,00 + 1 500,00 = 2 400,00." },
        { label: "Outil B, 12 mois", value: "6 000,00 MAD HT", annotation: "300,00 × 12 = 3 600,00, plus 2 400,00." },
        { label: "Outil B, 36 mois", value: "13 200,00 MAD HT", annotation: "300,00 × 36 = 10 800,00, plus 2 400,00 une seule fois." },
        { label: "Felexia, 12 mois", value: `${twelve} MAD HT`, annotation: "Tarif annuel publié. Abonnement seul." },
        { label: "Felexia, 36 mois", value: `${thirtySix} MAD HT`, annotation: "Trois fois le tarif annuel publié." },
      ],
    },
    p("Contrôle : 300,00 × 12 + 2 400,00 = 6 000,00. Sur 36 mois, 300,00 × 36 + 2 400,00 = 13 200,00. Remplacez l’outil B par les chiffres lus sur la page de l’éditeur."),
    h2("couts-caches", "Les coûts que la facture du logiciel ne montre pas"),
    p("L’outil déjà en place a aussi un coût, même quand sa licence est payée. Trois postes se notent à part, en heures ou en pièces, sans taux horaire appliqué à votre place."),
    bullets([
      ["Le temps. Comptez les heures passées à chercher une facture, à refaire un total ou à attendre la seule personne qui « sait où est le fichier ». Gardez les heures. Ne les multipliez pas par un salaire inventé."],
      ["Les erreurs. Un numéro sauté, un règlement saisi deux fois, un solde qui ne revient pas. Notez combien vous en avez repris le mois dernier. Ne leur donnez pas un pourcentage de chiffre d’affaires."],
      ["Les ressaisies. La même pièce dans un tableur, puis dans un autre outil, puis dans un message au comptable. Chaque copie est un poste. L’export CSV et le PDF, décrits sur l’accueil, servent à voir ce que vous pouvez sortir sans retaper."],
    ]),
    p("Dans l’exemple, Atlas Menuiserie note deux heures de ressaisie par semaine, sans les convertir en dirhams."),
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Le prix du logiciel n’est pas un avis fiscal. La déclaration de TVA préparée dans l’outil, et le fichier XML, se relisent avec votre conseil avant le dépôt. Le dépôt reste le vôtre. Ce guide ne choisit ni votre régime, ni vos taux.",
      ]],
    },
    h2("erreurs-frequentes", "Erreurs fréquentes quand on compare un prix"),
    p("Comparer un mois avec une année. Mettre zéro dès qu’un poste n’est pas écrit. Croire que l’essai ouvre les devis et le stock. Additionner un prix PRO qui n’existe pas en ligne. Recopier le tarif d’un concurrent sans la page, le lien et la date. Convertir des heures en dirhams avec un taux qui n’est pas le vôtre."),
    p("Un ERP plus large se juge sur le besoin, pas sur une ligne d’abonnement absente. Le cadre est dans ",
      { href: "/blog/erp-maroc-pme", label: "ERP au Maroc pour une PME" },
      ". Le quotidien de la facture est sur ",
      { href: "/logiciel-facturation-maroc", label: "le logiciel de facturation au Maroc" },
      "."),
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "ESSENTIEL réunit factures, avoirs, règlements, achats, banque, caisse, journaux et déclaration de TVA. Vous déposez le fichier vous-même. ",
        { href: "/essentiel", label: "L’offre ESSENTIEL" },
        " détaille ce périmètre.",
      ], [
        "Le parcours PDF, XML, émission et archivage est inclus après activation par l’administrateur. Felexia est prêt pour la facture électronique : le logiciel produit des factures en PDF et en XML et les archive. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Les fonctions seront mises à jour à la publication des textes. Voir ",
        { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
        ".",
      ], [
        `Prix public : ${offer.essentielPrice}. Essai de ${offer.trial}, sans carte. Devis, stock et paie : `,
        { href: "/pro", label: "PRO" },
        ", sur devis, hors essai.",
      ]],
    },
  ],
  questions: [
    {
      question: "Quel est le prix public d’un logiciel de gestion Felexia ?",
      answer: `Le 26 novembre 2026, la page Tarifs affiche ESSENTIEL à ${offer.monthly} MAD HT par mois, ou ${offer.yearly} MAD HT par an, soit douze mois sans remise. L’essai dure ${offer.trial}, sans carte bancaire. PRO n’a pas de prix public : la mise en place est sur devis.`,
    },
    {
      question: "L’abonnement annuel est-il inférieur à douze mois ?",
      answer: `Non. La page Tarifs indique que l’annuel est le même tarif, sans remise : ${twelve} MAD HT, soit douze fois ${offer.monthly} MAD HT. Sur 36 mois, trois fois ce tarif annuel font ${thirtySix} MAD HT.`,
    },
    {
      question: "Faut-il ajouter la formation, l’hébergement et la mise en place ?",
      answer: "Seulement s’ils sont chiffrés. Sur la page Tarifs du 26 novembre 2026, ces postes ne le sont pas pour ESSENTIEL. On les laisse visibles dans la grille, sans les mettre à zéro. Pour PRO, la mise en place est sur devis, sans montant publié.",
    },
    {
      question: "L’essai de 15 jours comprend-il les devis et le stock ?",
      answer: `Non. L’essai de ${offer.trial} ouvre ESSENTIEL : factures, règlements, journaux et déclaration de TVA. Les devis, les commandes, le stock et la paie sont dans PRO, qui ne s’essaie pas par l’essai public.`,
    },
    {
      question: "Peut-on comparer avec le prix d’un autre éditeur ?",
      answer: "Oui. Lisez-le sur le site de l’éditeur, le jour de la comparaison, et gardez le lien et la date. La dernière colonne du tableau est prévue pour ce relevé.",
    },
  ],
  cta: {
    label: `Essayer Felexia ${offer.trial}, sans carte bancaire`,
    href: "/login?mode=register",
    note: offer.offerPitch,
  },
  related: [
    { href: "/pricing", label: "Tarifs ESSENTIEL et PRO" },
    { href: "/essentiel", label: "Offre ESSENTIEL" },
    { href: "/pro", label: "ERP PRO, sur devis" },
    { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation au Maroc" },
    { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
    { href: "/blog/logiciel-gestion-pme-maroc", label: "10 critères pour choisir un logiciel de gestion" },
    { href: "/blog/erp-maroc-pme", label: "ERP au Maroc pour une PME" },
    { href: "/blog/facture-excel-ou-logiciel-maroc", label: "Excel ou un logiciel de facturation" },
    { href: "/blog/choisir-entre-essentiel-et-pro", label: "Choisir entre ESSENTIEL et PRO" },
    { href: "/blog/essai-gratuit-logiciel-gestion", label: "Plan d’essai sur 15 jours" },
  ],
  sources: [
    { label: `Felexia — page Tarifs, consultée le 26 novembre 2026 : ESSENTIEL à ${offer.monthly} MAD HT par mois ou ${offer.yearly} MAD HT par an, sans remise, essai de ${offer.trial} sans carte, jusqu’à ${offer.users} utilisateurs, ${offer.documents} documents commerciaux par mois, ${offer.storageGb} Go. PRO sur devis, sans prix public, jusqu’à ${offer.proUsers} utilisateurs, documents sans plafond mensuel, ${offer.proStorageGb} Go.`, href: "/pricing", consulted },
    { label: "Felexia — page ESSENTIEL : factures, avoirs, articles ou lignes libres, achats, banque, caisse, journaux, déclaration de TVA, export XML, essai et périmètre laissé à PRO.", href: "/essentiel", consulted },
    { label: "Felexia — page PRO : devis, commandes, livraisons, achats et réceptions, stock, plan comptable, prévisions, dossiers du personnel, paie préparatoire, mise en place sur devis, essai public limité à ESSENTIEL.", href: "/pro", consulted },
    { label: "Felexia — accueil, questions fréquentes : import CSV des clients et des fournisseurs, export PDF et CSV, contact e-mail et WhatsApp sans délai publié, consultation des données après l’essai.", href: "/", consulted },
    { label: "Felexia — page Facture électronique au Maroc : PDF, XML, émission et archivage après activation, sans connexion officielle à la DGI ni signature électronique qualifiée.", href: "/facturation-electronique-maroc", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les règles évoluent : vérifiez auprès de l’administration fiscale ou de votre expert-comptable. Les montants Felexia sont ceux de la page Tarifs au 26 novembre 2026. Les chiffres de l’outil B sont fictifs. Mis à jour le 26 novembre 2026.",
};

export default article;
