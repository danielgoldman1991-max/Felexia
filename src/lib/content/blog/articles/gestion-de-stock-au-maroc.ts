import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "03/11/2026";

const article: BlogArticle = {
  slug: "gestion-de-stock-au-maroc",
  path: "/blog/gestion-de-stock-au-maroc",
  title: "Gestion de stock au Maroc avec Felexia PRO | Felexia",
  description: "Gestion de stock au Maroc : emplacements, mouvements, réceptions et livraisons dans Felexia PRO. Un guide clair pour votre PME, proposé sur devis.",
  h1: "Logiciel de gestion de stock pour une PME au Maroc",
  category: "stock-achats",
  publishedAt: "2026-11-03",
  updatedAt: "2026-11-03",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-gestion-de-stock-au-maroc.webp",
    avif: "/images/blog/blog-gestion-de-stock-au-maroc.avif",
    alt: "Illustration d’une étagère de cartons avec une flèche d’entrée et une flèche de sortie, aux couleurs bleu marine et menthe.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "Le suivi des emplacements et des mouvements de stock est décrit dans Felexia PRO, pas sur les pages ESSENTIEL.",
    "PRO couvre les entrées, les sorties, les transferts, l’historique, les réceptions liées aux commandes fournisseurs, les livraisons et les retours clients.",
    "PRO se prépare sur devis et inclut tout ESSENTIEL, facturation comprise. L’essai gratuit ouvre d’abord ESSENTIEL.",
    "L’inventaire physique est signalé « à venir ». Il ne se compte pas comme une fonction utilisable.",
  ],
  introduction: [
    "Un logiciel de gestion de stock, pour une PME au Maroc, sert à savoir où sont les articles et quels documents ont fait entrer ou sortir une quantité. Dans Felexia, ce suivi fait partie de PRO. Il ne figure pas dans le descriptif public d’ESSENTIEL. ",
    "Vous y retrouvez les emplacements, les mouvements, les réceptions et les livraisons. Un exemple fictif montre comment les quantités s’enchaînent, sans méthode de valorisation.",
  ],
  blocks: [
    h2("ce-que-pro-montre", "Ce que PRO montre sur le stock"),
    p("La page PRO présente une vue sur le stock : retrouver les emplacements et les mouvements d’entrée et de sortie pour suivre les articles de l’entreprise. Le détail publié ajoute les transferts et l’historique des mouvements. L’objectif décrit est de rapprocher les quantités du terrain et les documents de gestion."),
    p(`Ce périmètre se cadre sur devis. La limite publique est de ${offer.proUsers} utilisateurs et ${offer.proStorageGb} Go de stockage, avec le socle ESSENTIEL inclus. La page Tarifs indique aussi des documents commerciaux sans plafond mensuel. Aucun prix de PRO n’est affiché. L’essai de ${offer.trial} concerne ESSENTIEL seulement.`),
    p("Le devis précise les fonctions utilisables. Les écrans marqués « à venir » sont exclus. Demander un devis ouvre un brouillon d’e-mail. La demande n’est transmise que si vous envoyez le message."),
    h3("les-mouvements", "Les mouvements que la page nomme"),
    p("Une entrée augmente la quantité d’un article sur un emplacement. Une sortie la diminue. Un transfert déplace une quantité d’un emplacement vers un autre, sans la faire disparaître de l’entreprise. L’historique garde la trace de ces opérations. Le site ne publie pas, dans ces pages, de seuil d’alerte, de code-barres, ni de formule de valorisation. Ces sujets ne sont donc pas présentés ici comme des fonctions disponibles."),
    {
      type: "table",
      caption: "Mouvements décrits pour le stock PRO",
      columns: ["Mouvement", "Ce que la page en dit", "Document souvent lié"],
      rows: [
        ["Emplacement", "Lieu de stockage où retrouver les quantités.", "Fiche de l’article dans l’entreprise"],
        ["Entrée", "Quantité qui arrive sur un emplacement.", "Réception liée à une commande fournisseur"],
        ["Sortie", "Quantité qui quitte un emplacement.", "Livraison client"],
        ["Transfert", "Quantité déplacée entre deux emplacements.", "Mouvement interne"],
        ["Historique", "Trace des mouvements déjà passés.", "Lecture des opérations"],
        ["Retour client", "Quantité qui revient après une livraison.", "Cycle de vente PRO"],
      ],
    },
    h2("lien-achats-ventes", "Le lien avec les achats et les ventes"),
    p("Côté achats, PRO ajoute les commandes fournisseurs et les réceptions aux factures et aux règlements déjà présents dans ESSENTIEL. La réception est liée à la commande. Elle dit ce qui est arrivé. La facture fournisseur dit ce qui est dû. Les deux pièces ne se confondent pas : l’une suit la marchandise, l’autre le paiement."),
    p("Côté ventes, le devis peut devenir une commande, puis une livraison ou un retour. La commande garde le lien avec la proposition retenue. La livraison indique les articles et les quantités qui quittent le stock. Le retour les fait revenir. La facture de vente et le règlement restent le socle ESSENTIEL, inclus dans PRO."),
    p("ESSENTIEL, lu seul, reste le logiciel de facturation et de trésorerie : clients, factures, avoirs et encaissements. Ses pages ne présentent pas le suivi des emplacements et des mouvements. Une PME qui ne fait que facturer des prestations n’a pas besoin de ce circuit pour commencer."),
    h3("un-circuit-simple", "Un circuit simple"),
    p("Le circuit publié tient en trois temps. D’abord le devis, converti en commande si le client retient la proposition. Ensuite la livraison, avec les quantités à sortir. Enfin le pilotage : mouvements, factures, règlements et écritures au même endroit, pour échanger avec les conseils. Rien, dans ce circuit, ne crée un inventaire physique automatique."),
    h2("exemple-fictif", "Exemple fictif : un distributeur à Casablanca"),
    p("Négoce des Oliviers est une société fictive. Elle range des ramettes de papier. Les quantités montrent une entrée, une sortie et un transfert, sans double compte et sans valorisation."),
    {
      type: "example",
      kicker: "Exemple fictif",
      title: "Ramettes de papier, deux emplacements",
      note: "Départ : 40 cartons sur l’emplacement Réserve. Comptoir : 0. Aucun prix de stock n’est calculé.",
      rows: [
        { label: "Réception", value: "+ 20 cartons en Réserve", annotation: "Liée à une commande fournisseur. Réserve passe de 40 à 60." },
        { label: "Livraison", value: "− 15 cartons depuis la Réserve", annotation: "Liée à une livraison client. Réserve passe de 60 à 45." },
        { label: "Transfert", value: "10 cartons de la Réserve vers le Comptoir", annotation: "La quantité quitte un emplacement et arrive sur l’autre. Total entreprise inchangé : 45 + 10 = 55, comme 60 − 15." },
        { label: "Retour", value: "+ 2 cartons en Réserve", annotation: "Retour client après livraison. Réserve passe de 45 à 47. Total : 57." },
        { label: "Lecture", value: "Réserve 47 · Comptoir 10", annotation: "L’historique doit permettre de retrouver ces quatre mouvements. Ce n’est pas un inventaire physique." },
      ],
    },
    p("Le contrôle est arithmétique : 40 + 20 − 15 − 10 + 2 = 47 en réserve, et les 10 cartons transférés sont au comptoir. Si un écran ne permet pas de retrouver l’une de ces lignes, la quantité affichée ne suffit pas à expliquer l’écart. C’est le rapprochement décrit entre le terrain et les documents, pas une preuve comptable."),
    h2("checklist-devis", "Check-list avant de demander le devis"),
    p("La demande est plus utile si elle décrit votre circuit réel. L’inventaire physique ne fait pas encore partie des fonctions à demander."),
    {
      type: "checklist",
      title: "À préparer pour le devis PRO",
      items: [
        "Le nombre d’emplacements à suivre, même s’il n’y en a que deux.",
        "Qui commande chez les fournisseurs, et qui enregistre la réception.",
        "Qui prépare le devis, qui le transforme en commande, qui livre.",
        "Si les retours clients doivent revenir sur un emplacement précis.",
        "Le nombre de personnes qui ouvriront le logiciel, dans la limite publiée de 25 utilisateurs.",
        "Ce qui doit rester dans le socle ESSENTIEL : factures, règlements, banque, journaux.",
        "La confirmation que l’inventaire physique n’est pas compté comme disponible.",
        "Le canal de la demande : la page PRO, puis l’envoi effectif du message.",
      ],
    },
    h2("pas-encore-un-inventaire", "Ce qui n’est pas encore un inventaire utilisable"),
    p("L’inventaire physique est signalé « à venir ». Il ne faut pas le compter dans un devis, ni l’annoncer à une équipe comme un comptage déjà possible dans le logiciel. Les écrans marqués « à venir », dont l’agenda, sont dans le même cas."),
    p("Les quantités suivies aident le pilotage. Elles ne dispensent pas de contrôler les écarts sur le terrain. Elles ne disent pas, à elles seules, comment comptabiliser le stock. Ce traitement se valide avec votre conseil. Le site ne publie pas ici de méthode de coût unitaire moyen pondéré ni de premier entré, premier sorti."),
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Un mouvement de stock n’est pas une écriture comptable validée. La facture fournisseur, la facture client et le traitement du stock restent à accorder avec votre conseil. Felexia relie les documents décrits. Il ne signe pas la liasse.",
      ]],
    },
    h2("erreurs-frequentes", "Erreurs fréquentes"),
    p("La première est de chercher les emplacements dans ESSENTIEL. Les pages de cette offre parlent de factures, d’achats, de règlements et de trésorerie. Le stock nommé sur le site est celui de PRO."),
    p("La deuxième est d’ouvrir l’essai gratuit en pensant compter les cartons. L’essai gratuit ouvre ESSENTIEL, pour facturer et suivre les règlements. " + offer.offerPitch),
    p("La troisième est de confondre la réception et la facture fournisseur, ou la livraison et la facture client. La marchandise et le paiement se suivent ensemble, mais ce ne sont pas les mêmes pièces. La quatrième est de prendre un transfert pour une sortie : la quantité change d’emplacement, elle ne quitte pas l’entreprise."),
    p("La cinquième est d’ajouter l’inventaire physique à la liste des fonctions attendues le jour du devis. La sixième est de citer un gain de stock ou un pourcentage de chiffre d’affaires évité. Aucun de ces chiffres n’est publié par Felexia, et ce guide n’en crée pas."),
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "PRO réunit le socle ESSENTIEL et le stock : emplacements, mouvements, réceptions, livraisons et retours. La facturation électronique PDF/XML et l’archivage restent inclus après activation, dans les deux offres. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. ",
        { href: "/pro", label: "La page PRO" },
        " détaille le périmètre avant la demande de devis. Pour seulement facturer et suivre les règlements, ESSENTIEL suffit, avec son essai sans carte.",
      ]],
    },
    h2("pour-qui", "Pour qui ce suivi est utile"),
    p("Il est utile dès qu’une quantité quitte un emplacement et qu’une autre équipe doit la retrouver : négoce, distribution, atelier qui livre des marchandises. La page PRO le dit pour le négoce : présentez les devis, les commandes, les livraisons, les achats et les mouvements. Pour une activité de services sans marchandise, le même texte demande de préciser les étapes commerciales et le suivi des règlements. Le stock n’est alors pas le premier parcours."),
    p("Dans les deux cas, le nombre d’utilisateurs et le circuit prioritaire cadrent la demande. Jusqu’à trois personnes, et sans emplacement à suivre, la limite et les fonctions d’ESSENTIEL peuvent suffire. Au-delà, ou dès qu’une réception doit être liée à une commande, la conversation porte sur PRO. Le devis dit ce qui est utilisable. Il ne transforme pas un écran « à venir » en fonction livrée."),
  ],
  questions: [
    {
      question: "La gestion de stock est-elle dans ESSENTIEL ?",
      answer: "Non, d’après les pages publiques. ESSENTIEL décrit la facturation, les achats, les règlements et la trésorerie. Les emplacements, les mouvements, les réceptions et les livraisons sont présentés dans PRO.",
    },
    {
      question: "Puis-je faire un inventaire physique ?",
      answer: "Non. L’inventaire physique reste un écran « à venir ». Il n’est pas une fonction opérationnelle à inclure dans le devis.",
    },
    {
      question: "L’essai gratuit permet-il de tester le stock ?",
      answer: `Non. L’essai de ${offer.trial}, sans carte bancaire, concerne ESSENTIEL. PRO se découvre sur demande. Le brouillon d’e-mail doit être envoyé pour transmettre la demande.`,
    },
    {
      question: "Une réception remplace-t-elle la facture fournisseur ?",
      answer: "Non. La réception suit la marchandise liée à la commande. La facture fournisseur et le règlement suivent le montant dû. Les deux existent dans le parcours PRO, sans se confondre.",
    },
    {
      question: "Faut-il PRO pour la facture électronique ?",
      answer: "Non. La génération PDF/XML, l’émission et l’archivage sont inclus dans ESSENTIEL et dans PRO, après activation par l’administrateur. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée.",
    },
  ],
  cta: {
    label: "Demander un devis PRO",
    href: "/pro",
    note: `La page PRO présente le périmètre, puis ouvre un brouillon d’e-mail à envoyer. ${offer.offerPitch}`,
  },
  related: [
    { href: "/pro", label: "Périmètre de l’ERP PRO" },
    { href: "/pricing", label: "Tarifs ESSENTIEL et PRO" },
    { href: "/blog/choisir-entre-essentiel-et-pro", label: "Choisir entre ESSENTIEL et PRO" },
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
  ],
  sources: [
    { label: "Felexia — page PRO : emplacements, mouvements, réceptions, livraisons, retours, limites et fonctions à venir", href: "/pro", consulted },
    { label: "Felexia — page Tarifs : stock dans PRO, plafond de documents, 20 Go, 25 utilisateurs, essai ESSENTIEL", href: "/pricing", consulted },
    { label: "Felexia — page ESSENTIEL : facturation et trésorerie, sans suivi des emplacements", href: "/essentiel", consulted },
    { label: "Felexia — facturation électronique, incluse dans les deux offres après activation", href: "/facturation-electronique-maroc", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les fonctions présentées sont celles de Felexia PRO au 3 novembre 2026. L’inventaire physique n’est pas encore disponible. Le traitement comptable du stock se valide avec votre conseil. Mis à jour le 3 novembre 2026.",
};

export default article;
