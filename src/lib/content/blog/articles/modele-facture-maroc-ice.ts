import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "10/11/2026";

const article: BlogArticle = {
  slug: "modele-facture-maroc-ice",
  path: "/blog/modele-facture-maroc-ice",
  title: "Modèle de facture au Maroc avec ICE | Felexia",
  description: "Modèle de facture au Maroc avec ICE, à copier : les mentions de l’article 145 du CGI, un exemple fictif en dirhams et les erreurs à éviter avant l’envoi.",
  h1: "Modèle de facture au Maroc avec ICE : exemple annoté, à copier",
  category: "facturation",
  publishedAt: "2026-11-10",
  updatedAt: "2026-11-10",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-modele-facture-maroc-ice.webp",
    avif: "/images/blog/blog-modele-facture-maroc-ice.avif",
    alt: "Illustration d’une facture stylisée annotée par des pastilles colorées, avec un tampon, un carnet et une plante.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "Le modèle ci-dessous reprend les mentions lues à l’article 145 du CGI, édition 2026 publiée par la DGI : série continue, identité, identifiant fiscal, taxe professionnelle, date, client, opération, TVA distincte, paiement, et ICE.",
    "L’ICE du vendeur est demandé par l’article 145-VIII. L’article 145-III-4° demande aussi l’ICE du client. L’article 198 ter prévoit 100 dirhams par omission ou inexactitude sur le VIII.",
    "L’exemple est fictif. Les noms n’existent pas. Les deux ICE sont l’identifiant de démonstration 000000000000000. Le calcul, au taux normal de 20 % (article 99-A), se contrôle : hors taxe plus TVA égale toutes taxes comprises.",
    "Ce modèle ne décrit pas la facture de l’auto-entrepreneur : l’article 145-XI écarte l’article 145 pour ce régime, sous réserve de l’adresse électronique du paragraphe X.",
  ],
  introduction: [
    "Un modèle de facture au Maroc avec ICE sert à voir, ligne par ligne, ce que l’article 145 du Code général des impôts demande avant l’envoi. Vous pouvez recopier la structure. Vous remplacez ensuite chaque case par les données de votre entreprise et de votre client. ",
    "Le tableau est annoté. Chaque mention renvoie au paragraphe lu dans l’édition 2026 du CGI, sur tax.gov.ma, le 10 novembre 2026. L’exemple en dirhams est fictif. La ",
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "checklist des mentions obligatoires" },
    " détaille le même article. Ici, l’objectif est le document à remplir.",
  ],
  blocks: [
    h2("mentions-a-porter", "Quelles mentions le modèle doit porter ?"),
    p("L’article 145-III, sous réserve du paragraphe IX, oblige à délivrer aux acheteurs ou clients des factures ou mémoires. Ils sont pré-numérotés et tirés d’une série continue, ou édités par un système informatique selon une série continue. Le texte ajoute « en plus des indications habituelles d’ordre commercial », sans définir cette formule."),
    p("Le 1° demande l’identité du vendeur. Le 2° demande le numéro d’identification fiscale du service local des impôts et le numéro d’article d’imposition à la taxe professionnelle. Le 3° demande la date de l’opération. Le 4° demande les nom, prénoms ou raison sociale, l’adresse du client, et son identifiant commun de l’entreprise. Le 5° demande le prix, la quantité et la nature des marchandises, travaux ou services. Le 6° demande le montant de la TVA, distinct, en sus du prix ou compris dans le prix. Pour les opérations des articles 91, 92 ou 94, cette mention est remplacée par l’exonération ou le régime suspensif. Le 7° demande les références et le mode de paiement. Le 8° renvoie à d’autres textes, sans les énumérer."),
    p("L’ICE de celui qui délivre la facture est à l’article 145-VIII, pas au 1°. L’article 146 demande qu’une facture régulière comporte les indications des paragraphes III et VIII. L’article 119-I vise les factures des opérations soumises à la TVA, établies selon le 145-III. Ces paragraphes ne fixent pas le nombre de caractères de l’ICE. Reprenez l’identifiant tel qu’il figure sur vos documents officiels. L’exemple n’utilise que des zéros."),
    h3("hors-de-ce-modele", "Ce que ce modèle ne couvre pas"),
    p("Pour une vente de produits ou de marchandises à des particuliers, le ticket de caisse peut tenir lieu de facture. Sa liste, lue à l’article 145-III, est plus courte. L’article 145-XI écarte l’article 145 pour les personnes physiques au régime de la contribution professionnelle unique ou de l’auto-entrepreneur, sous réserve de l’adresse électronique du paragraphe X. Si vous êtes dans l’un de ces cas, ne recopiez pas ce modèle tel quel."),
    h2("modele-annote", "Le modèle annoté, zone par zone"),
    p("Le tableau est un exemple fictif. Menuiserie des Deux Rives, Boutique des Remparts, les adresses et les numéros n’existent pas. Le taux retenu est le taux normal de 20 % de l’article 99-A, pour des ouvrages qui ne sont pas présentés comme relevant du 99-B. Quatre portes à 1 250,00 dirhams hors taxe font 5 000,00. Quatre poses à 180,00 dirhams font 720,00. Le hors taxe fait 5 720,00. La TVA à 20 % fait 1 144,00. Le total fait 6 864,00."),
    {
      type: "table",
      caption: "Exemple fictif — facture FAC-DEMO-0007, annotée selon l’article 145, état au 10 novembre 2026",
      columns: ["Zone", "Ce que vous écrivez", "Article lu"],
      rows: [
        ["Numéro", "FAC-DEMO-0007", "145-III, chapeau. Série continue. Le préfixe n’est pas imposé."],
        ["Vendeur", "Menuiserie des Deux Rives, 8 rue des Oliviers, Tanger", "145-III-1°. Identité. Société fictive."],
        ["Identifiant fiscal", "IF 00000000", "145-III-2°. Numéro fictif."],
        ["Taxe professionnelle", "Article 00000000", "145-III-2°. Numéro fictif."],
        ["ICE du vendeur", "000000000000000", "145-VIII. Démonstration, sans existence réelle."],
        ["Date", "10 novembre 2026", "145-III-3°. Date de l’opération."],
        ["Client", "Boutique des Remparts, 15 boulevard des Remparts, Marrakech", "145-III-4°. Nom et adresse. Client fictif."],
        ["ICE du client", "000000000000000", "145-III-4°. Même identifiant de démonstration."],
        ["Ligne 1", "4 portes intérieures × 1 250,00 MAD", "145-III-5°. Nature, quantité, prix."],
        ["Ligne 2", "4 poses sur site × 180,00 MAD", "145-III-5°. Nature, quantité, prix."],
        ["Hors taxe", "5 720,00 MAD", "5 000,00 + 720,00. Calcul de l’exemple."],
        ["TVA", "1 144,00 MAD, soit 20 %", "145-III-6° et taux normal, article 99-A."],
        ["Total", "6 864,00 MAD", "5 720,00 + 1 144,00. Contrôle du calcul."],
        ["Paiement", "Virement bancaire, référence VIR-DEMO-0007", "145-III-7°. Mode et référence fictifs."],
      ],
    },
    p("Hors taxe plus TVA égale toutes taxes comprises : 5 720,00 + 1 144,00 = 6 864,00. Si l’opération est listée à l’article 99-B, le taux lu est de 10 %. Si elle relève des articles 91, 92 ou 94, vous remplacez la ligne de TVA par l’indication de l’exonération ou du régime suspensif."),
    h2("avant-envoi", "Check-list avant d’envoyer la facture"),
    p("Relisez la pièce que vous tenez, pas le modèle. Cochez seulement ce qui est écrit sur le document."),
    {
      type: "checklist",
      title: "Avant envoi",
      items: [
        "Le numéro suit votre série continue.",
        "L’identité, l’identifiant fiscal et la taxe professionnelle sont ceux de votre entreprise.",
        "L’ICE du vendeur est recopié depuis vos documents officiels.",
        "La date de l’opération est indiquée.",
        "Le client a un nom et une adresse. Son ICE figure lorsque le 145-III-4° s’applique.",
        "Chaque ligne a une nature, une quantité et un prix.",
        "La TVA est distincte, ou l’exonération la remplace.",
        "Hors taxe, TVA et total se recalculent sans écart.",
        "Le mode de paiement et ses références sont écrits.",
        "Le double peut être conservé dix ans, article 211.",
      ],
    },
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "Le taux, l’exonération et le droit à déduction dépendent de l’opération et du régime du client. L’article 146 décrit la facture régulière. Il ne dit pas, à lui seul, ce qu’un contrôle retiendra dans votre dossier. Faites relire le modèle avant de l’utiliser comme document type. Le registre du commerce et la CNSS ne figurent pas dans l’article 145 : demandez à votre conseil s’ils vous concernent.",
      ]],
    },
    h2("erreurs-frequentes", "Erreurs fréquentes"),
    p("Un numéro hors de la série continue casse la suite demandée par le chapeau de l’article 145-III. Une TVA fondue dans le prix, sans montant distinct, manque au 6° lorsque l’opération n’est ni exonérée ni en régime suspensif. Recopier un taux lu sur un autre site est une autre erreur : l’article 99 de l’édition 2026 indique 20 % et 10 %. Mentionner la TVA à tort rend redevable du seul fait de la facturation, article 119-II."),
    p("Oublier l’ICE du vendeur est la mention que l’article 198 ter chiffre : 100 dirhams par omission ou inexactitude relevée sur l’article 145-VIII. Ce montant, dans le texte lu, ne s’étend pas à chaque autre case vide. Utiliser le ticket de caisse à la place de la facture ne vaut que pour une vente de produits ou de marchandises à des particuliers. Confondre l’ICE de démonstration de cet exemple avec le vôtre rendrait le document inutilisable."),
    h2("facture-electronique", "Et la facture électronique ?"),
    p("L’article 145-IX demande, pour les régimes qu’il vise, un système informatique de facturation répondant aux critères de l’administration. Les modalités sont renvoyées à un texte réglementaire, par secteur. Ce paragraphe ne fixe ni date, ni seuil, ni format. Le projet de loi de finances n° 60-26 ne cite pas l’article 145 dans la liste de son article 7-I. L’état des textes est dans ",
      { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Facture électronique au Maroc : où en est-on ?" },
      ". Les autres mesures de ce projet, distinctes de la facture, sont dans ",
      { href: "/blog/plf-2027-pme-maroc", label: "Projet de loi de finances 2027 : ce qui pourrait changer pour les PME" },
      "."),
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "Dans ESSENTIEL, vous établissez les factures de vente, les avoirs et les règlements. Le PDF reprend le logo, les coordonnées et l’ICE lorsque vous les avez renseignés. Vous vérifiez les mentions avant d’envoyer la pièce. ",
        { href: "/logiciel-facturation-maroc", label: "Le logiciel de facturation au Maroc" },
        " décrit ce quotidien. La génération PDF/XML, l’émission et l’archivage sont inclus après activation par l’administrateur. Felexia est prêt pour la facture électronique au sens de ce parcours documentaire. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée. Les fonctions seront mises à jour à la publication des textes.",
      ], [
        offer.offerPitch,
      ]],
    },
  ],
  questions: [
    {
      question: "Puis-je recopier ce modèle tel quel ?",
      answer: "Vous pouvez recopier la structure. Vous remplacez les noms, adresses, numéros et montants par les vôtres. L’ICE 000000000000000, l’identifiant fiscal et la taxe professionnelle de l’exemple sont fictifs. L’article 145 ne fixe pas, dans les paragraphes lus, le nombre de caractères de l’ICE.",
    },
    {
      question: "Où placer l’ICE du vendeur et celui du client ?",
      answer: "L’article 145-VIII demande l’ICE de celui qui délivre la facture. L’article 145-III-4° demande l’ICE du client avec son nom et son adresse. L’article 198 ter chiffre l’omission ou l’inexactitude sur le VIII : 100 dirhams. L’article 146 demande les indications des deux paragraphes pour une facture régulière.",
    },
    {
      question: "Quel taux de TVA écrire sur l’exemple ?",
      answer: "L’exemple utilise le taux normal de 20 % de l’article 99-A. L’article 99-B retient 10 % pour les opérations qu’il liste. Les articles 91, 92 et 94 remplacent la mention de taxe par l’exonération ou le régime suspensif. Le taux de votre ligne se vérifie dans le CGI, avec votre expert-comptable.",
    },
    {
      question: "Le modèle vaut-il pour un auto-entrepreneur ?",
      answer: "Non. L’article 145-XI écarte l’article 145 pour les personnes physiques au régime de la contribution professionnelle unique ou de l’auto-entrepreneur, sous réserve de l’adresse électronique du paragraphe X. Ce modèle ne décrit pas leur facture.",
    },
    {
      question: "Felexia envoie-t-il cette facture à la DGI ?",
      answer: "Non. Le parcours couvre le PDF, le XML, l’émission et l’archivage après activation par l’administrateur. Felexia est prêt pour la facture électronique au sens de ce parcours. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée.",
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
    { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions obligatoires d’une facture" },
    { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Où en est la facture électronique" },
    { href: "/blog/plf-2027-pme-maroc", label: "Projet de loi de finances 2027 et les PME" },
  ],
  sources: [
    { label: "Direction générale des impôts — page Documentation fiscale, édition du Code général des impôts 2026 listée au 30 décembre 2025", href: "https://www.tax.gov.ma/wps/portal/DGI/Documentation-fiscale/Arretes", consulted },
    { label: "Direction générale des impôts — Code général des impôts 2026, fichier « CGI 2026 FR.pdf ». Articles 91, 92, 94, 99, 119, 145 (III, VIII, IX, X, XI), 146, 198 ter et 211.", href: "https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES", consulted },
    { label: "Ministère de l’Économie et des Finances — corps du projet de loi de finances n° 60-26 pour 2027, article 7-I (l’article 145 n’est pas dans la liste)", href: "https://www.finances.gov.ma/Publication/db/2027/corps-PLF2027-fr.pdf", consulted },
    { label: "Felexia — page Logiciel de facturation au Maroc, pour le périmètre du produit cité dans l’encadré", href: "/logiciel-facturation-maroc", consulted },
    { label: "Felexia — page Tarifs, pour le prix ESSENTIEL et la durée d’essai", href: "/pricing", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Les règles évoluent : vérifiez auprès de l’administration fiscale ou de votre expert-comptable. Mis à jour le 10 novembre 2026.",
};

export default article;
