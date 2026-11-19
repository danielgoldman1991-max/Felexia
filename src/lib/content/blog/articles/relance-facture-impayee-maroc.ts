import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "19/11/2026";

const article: BlogArticle = {
  slug: "relance-facture-impayee-maroc",
  path: "/blog/relance-facture-impayee-maroc",
  title: "Relance facture impayée : calendrier et modèles | Felexia",
  description: "Relancer une facture impayée au Maroc : délais légaux de 60 et 120 jours, amende de la loi 69-21, modèles d’e-mail et de WhatsApp prêts à copier.",
  h1: "Relancer une facture impayée : calendrier et modèles de messages",
  category: "tresorerie",
  publishedAt: "2026-11-19",
  updatedAt: "2026-11-19",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-relance-facture-impayee-maroc.webp",
    avif: "/images/blog/blog-relance-facture-impayee-maroc.avif",
    alt: "Illustration d’une facture, d’une horloge, d’une pile de pièces et d’un message, sur un fond clair bleu et menthe.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "Sans accord, 60 jours à compter de l’émission. Avec accord, 120 jours au plus (article 78-2, loi 69-21).",
    "Le chapitre ne vise pas les personnes dont le chiffre d’affaires annuel est inférieur ou égal à 2 000 000 de dirhams hors TVA.",
    "L’amende suit le taux directeur de Bank Al-Maghrib à la fin du premier mois de retard, plus 0,85 % par mois ou fraction, sur le TTC impayé.",
    "Au-dessus de 2 000 000 de dirhams hors TVA, la déclaration électronique est due avant la fin du mois qui suit le trimestre, même sans retard.",
  ],
  introduction: [
    "Relancer une facture, c’est un message clair, puis le délai de la loi 69-21. ",
    "Sans accord, le paiement est dû dans les 60 jours de l’émission. Un accord ne dépasse pas 120 jours. Le texte lu est le Bulletin officiel n° 7204 du 15 juin 2023. La taxe de la pièce se rattache au ",
    { href: "/blog/tva-maroc-pme", label: "guide de la TVA" },
    ", et les mentions à la ",
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "checklist de l’article 145" },
    ".",
  ],
  blocks: [
    h2("delais", "60 jours ou 120 jours"),
    p("La loi n° 69-21, dahir n° 1-23-40 du 25 mai 2023, réécrit le chapitre des délais de paiement du code de commerce. L’article 78-2 fixe 60 jours à compter de la date d’émission si rien n’est convenu, et 120 jours au plus si un délai l’est. Pour un établissement public visé à l’article 78-1, ces délais courent de la constatation du service fait."),
    p("La facture s’émet au plus tard le dernier jour du mois. Sinon, le délai court de la fin de ce mois. Des opérations d’au plus un mois courent du 1er du mois suivant. Un décret, après avis du Conseil de la concurrence, peut aller jusqu’à 180 jours."),
    {
      type: "table",
      caption: "Délais de l’article 78-2, loi 69-21",
      columns: ["Situation", "Départ", "Plafond"],
      rows: [
        ["Pas d’accord", "Date d’émission", "60 jours"],
        ["Accord", "Date d’émission", "120 jours"],
        ["Établissement public visé", "Service fait", "Les deux délais"],
        ["Facture après la fin du mois", "Fin de ce mois", "Le délai de l’article"],
      ],
    },
    p("L’article 78-1 écarte le chapitre à 2 000 000 de dirhams hors TVA ou en dessous. Il vise les commerçants établis au Maroc, ainsi que certains délégataires et établissements publics."),
    h2("amende", "Amende et déclaration"),
    p("Sous réserve de l’article 690, chaque manquement à l’article 78-2 ouvre une amende au Trésor. Son taux est le taux directeur de Bank Al-Maghrib à la clôture du premier mois de retard, plus 0,85 % par mois ou fraction de mois supplémentaire. Elle porte sur le montant impayé dans le délai, facture par facture, taxe comprise. Elle se paie avec la déclaration. Elle est suspendue si la facture est au tribunal, jusqu’au jugement définitif, et reste due sur les sommes exigibles après. Le créancier garde le droit de demander réparation."),
    p("Au-dessus de 2 000 000 de dirhams hors TVA, l’article 78-4 demande une déclaration électronique avant la fin du mois qui suit le trimestre, même sans retard, avec un état visé par le commissaire aux comptes dès 50 000 000, sinon par un expert-comptable ou un comptable agréé. L’article 78-5 la confie à l’autorité chargée des finances ou à son délégataire. L’article 78-8 envoie la liste annuelle des manquements à l’Observatoire des délais de paiement. Pour le troisième trimestre 2026, la DGI indique le 2 novembre 2026."),
    p("L’article 78-6 échelonne le défaut de déclaration ou de paiement de l’amende, de 5 000 à 250 000 dirhams selon le chiffre d’affaires, et 5 000 dirhams par facture incomplète. L’amende de l’article 78-3 ne vise pas une facture émise avant le 1er janvier 2025 d’au plus 10 000 dirhams TTC."),
    h2("calendrier", "Un calendrier de messages, distinct du délai légal"),
    p("Le rythme ci-dessous est une pratique d’entreprise. Le délai légal reste celui de l’article 78-2."),
    {
      type: "table",
      caption: "Rythme proposé. Il ne remplace pas l’article 78-2.",
      columns: ["Moment", "Message"],
      rows: [
        ["Date convenue", "Rappel courtois, numéro et montant"],
        ["Quelques jours après", "Deuxième message, demande d’une date"],
        ["Après le délai de l’article 78-2", "L’amende de l’article 78-3 peut s’ouvrir"],
      ],
    },
    h2("modeles", "Deux modèles fictifs"),
    p("Maison Nour et Atelier Lumen sont fictifs. ICE 000000000000000. FAC-DEMO-0018, du 16 septembre 2026, est convenue au 31 octobre. 10 000,00 hors taxe, taxe 2 000,00 si l’article 99-A s’applique, total 12 000,00."),
    h3("email", "E-mail"),
    p("Objet : Facture FAC-DEMO-0018 — échéance du 31 octobre 2026. Bonjour, cette facture, émise le 16 septembre 2026, de 12 000,00 dirhams TTC, arrive à la date convenue. Pouvez-vous indiquer le jour du règlement ? Atelier Lumen, Casablanca. ICE 000000000000000."),
    h3("whatsapp", "WhatsApp"),
    p("Bonjour, rappel courtois : la facture FAC-DEMO-0018 de l’Atelier Lumen, 12 000,00 dirhams TTC, était convenue au 31 octobre 2026. Dites-nous une date de règlement. ICE de démonstration 000000000000000. Merci."),
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Le chapitre dépend du chiffre d’affaires et des parties. Le décompte des jours, un décret de secteur et l’article 690, réservé par l’article 78-3, se confirment sur votre dossier.",
      ]],
    },
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "Dans ESSENTIEL, le règlement se rattache à la facture et au compte ou à la caisse. Vous voyez le solde. Les modèles se copient dans votre messagerie : le logiciel ne les envoie pas. Le détail est sur ",
        { href: "/logiciel-facturation-maroc", label: "le logiciel de facturation au Maroc" },
        ".",
      ], [
        "Après activation, le PDF et le XML couvrent les factures et les avoirs clients. Felexia est prêt pour la facture électronique : le logiciel produit des factures en PDF et en XML et les archive. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Voir ",
        { href: "/facturation-electronique-maroc", label: "Facture électronique au Maroc" },
        ", ",
        { href: "/blog/avoir-facture-maroc", label: "l’avoir" },
        " et ",
        { href: "/blog/numerotation-facture-maroc", label: "la numérotation" },
        ".",
      ]],
    },
  ],
  questions: [
    {
      question: "Quel est le délai de paiement entre entreprises au Maroc ?",
      answer: "L’article 78-2 de la loi 69-21 fixe 60 jours à compter de la date d’émission si rien n’est convenu, et 120 jours au plus si un délai l’est. Le chapitre ne s’applique pas lorsque le chiffre d’affaires annuel est inférieur ou égal à 2 000 000 de dirhams hors TVA.",
    },
    {
      question: "Une facture impayée ouvre-t-elle une amende ?",
      answer: "L’article 78-3 prévoit une amende au Trésor pour chaque manquement à l’article 78-2, sous réserve de l’article 690. Le taux est le taux directeur de Bank Al-Maghrib à la clôture du premier mois de retard, plus 0,85 % par mois ou fraction. Il s’applique au montant impayé dans le délai, facture par facture, taxe comprise.",
    },
    {
      question: "Faut-il déclarer les délais même sans retard ?",
      answer: "Oui, au-dessus de 2 000 000 de dirhams hors TVA. L’article 78-4 demande une déclaration électronique avant la fin du mois qui suit le trimestre, même sans facture en retard. L’article 78-5 la confie à l’autorité chargée des finances ou à son délégataire. Pour le troisième trimestre 2026, la DGI indique le 2 novembre 2026.",
    },
    {
      question: "Le calendrier de messages est-il imposé par la loi ?",
      answer: "Non. Le rappel à la date convenue, puis un second message, est un rythme d’entreprise. La loi fixe le délai de l’article 78-2 et l’amende de l’article 78-3. Elle ne fixe pas le nombre d’e-mails ni de messages WhatsApp.",
    },
    {
      question: "Felexia envoie-t-il la relance ?",
      answer: "Non. ESSENTIEL rattache le règlement à la facture et montre le solde. Les modèles se copient dans votre messagerie. Le parcours PDF et XML ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée.",
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
    { href: "/blog/tva-maroc-pme", label: "TVA au Maroc pour une PME" },
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
    { href: "/blog/numerotation-facture-maroc", label: "Numérotation des factures" },
    { href: "/blog/avoir-facture-maroc", label: "Avoir ou annulation d’une facture" },
  ],
  sources: [
    { label: "Secrétariat général du gouvernement — Bulletin officiel, édition générale, n° 7204 du 26 kaada 1444 (15 juin 2023). Dahir n° 1-23-40 du 5 kaada 1444 (25 mai 2023) portant promulgation de la loi n° 69-21. Articles 78-1 à 78-8 et dispositions transitoires de l’article 2 : exclusion à 2 000 000 de dirhams hors TVA, délais de 60 et 120 jours, décret possible à 180 jours, amende, déclaration trimestrielle, liste envoyée à l’Observatoire des délais de paiement.", href: "https://www.sgg.gov.ma/BO/AR/3111/2023/BO_7204_Ar.pdf", consulted },
    { label: "Direction générale des impôts — communiqués de presse, page consultée le 19/11/2026. Déclaration des délais de paiement du troisième trimestre 2026 : au plus tard le 2 novembre 2026, pour un chiffre d’affaires supérieur à 2 millions de dirhams.", href: "https://www.tax.gov.ma/wps/portal/DGI/Presse/Communiques-de-presse", consulted },
    { label: "Direction générale des impôts — Code général des impôts, édition 2026, article 99-A. Le taux de 20 % de l’exemple fictif ne vaut que si l’opération n’est pas au 99-B.", href: "https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES", consulted },
    { label: "Felexia — page Logiciel de facturation au Maroc : factures, avoirs et règlements", href: "/logiciel-facturation-maroc", consulted },
    { label: "Felexia — page Facture électronique au Maroc : PDF et XML, sans connexion officielle à la DGI", href: "/facturation-electronique-maroc", consulted },
    { label: "Felexia — page Tarifs, consultée le 19/11/2026 : 99 MAD HT par mois, 1 188 MAD HT par an, essai de 15 jours sans carte bancaire", href: "/pricing", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les règles évoluent : vérifiez auprès de l’administration fiscale ou de votre expert-comptable. Mis à jour le 19 novembre 2026.",
};

export default article;
