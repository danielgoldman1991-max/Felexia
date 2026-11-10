import { publicOfferCopy } from "@/lib/content/blog/offers";
import { h2, h3, p, type BlogArticle } from "@/lib/content/blog/types";

const offer = publicOfferCopy();
const consulted = "10/11/2026";

const article: BlogArticle = {
  slug: "plf-2027-pme-maroc",
  path: "/blog/plf-2027-pme-maroc",
  title: "PLF 2027 : ce qui pourrait changer pour les PME | Felexia",
  description: "Projet de loi de finances 2027 pour les PME : restitution de TVA, dépôt bancaire et avance à l’importation. Ce projet n’est pas encore voté.",
  h1: "Projet de loi de finances 2027 : ce qui pourrait changer pour les PME",
  category: "tva-fiscalite",
  publishedAt: "2026-11-10",
  updatedAt: "2026-11-10",
  author: "Équipe Felexia",
  cover: {
    webp: "/images/blog/blog-plf-2027-pme-maroc.webp",
    avif: "/images/blog/blog-plf-2027-pme-maroc.avif",
    alt: "Illustration d’une balance portant un pourcentage, d’un calendrier vierge et d’une pile de pièces, en bleu et or.",
    width: 1600,
    height: 900,
  },
  essentials: [
    "Le texte est le projet n° 60-26, publié par le ministère le 23 octobre 2026. Ce n’est pas une loi : le Parlement peut l’amender jusqu’au vote.",
    "Quatre mesures visent une partie des PME : restitution de TVA retenue à la source, dépôt bancaire, avance de 5 % pour certains importateurs, TVA sur la marge pour des marchands de biens.",
    "Le projet date la restitution et le dépôt du 1er janvier 2027, l’avance et la marge du 1er juillet 2027. Ces dates ne valent que si le vote les conserve.",
    "L’article 145, celui des factures, n’est pas dans la liste de l’article 7-I. Vos mentions actuelles ne changent pas.",
  ],
  introduction: [
    "Le projet de loi de finances 2027 peut toucher la TVA, le paiement de certaines charges et l’impôt de certains importateurs. Il ne s’applique pas. Le ministère de l’Économie et des Finances date le corps du projet et la note de présentation du 23 octobre 2026. Le 29 octobre, la commission des finances de la Chambre des représentants en débattait encore. ",
    "Quatre mesures du projet n° 60-26 concernent une partie des PME. Les dates ci-dessous sont celles du projet, pas celles d’une loi votée.",
  ],
  blocks: [
    h2("ou-en-est-le-projet", "Où en est le projet ?"),
    p("Le document s’intitule « Projet de loi de finances n° 60-26 pour l’année budgétaire 2027 ». La Chambre des représentants et le ministère en publient le texte. Tant qu’il n’est pas voté puis promulgué, les articles ci-dessous restent des propositions : ils peuvent être amendés, retirés ou datés autrement."),
    p("L’article 7-I liste les articles du CGI qu’il modifierait au 1er janvier 2027. L’article 145 n’y figure pas. La facture électronique suit ",
      { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "l’état des lieux déjà publié" },
      "."),
    h2("quatre-mesures", "Quatre mesures à suivre de près"),
    p("Le tableau reprend le corps du projet, état au 10 novembre 2026. La note de présentation en explique l’intention."),
    {
      type: "table",
      caption: "Mesures du projet n° 60-26 utiles à une partie des PME — pas encore une loi",
      columns: ["Mesure", "Ce que le projet écrirait", "Date proposée"],
      rows: [
        ["Restitution de TVA retenue", "Art. 240 : excédent des art. 117-IV et V non imputé sur la TVA due, restitué au fournisseur sur demande après le trimestre. Ce montant ne s’impute pas et s’annule sur la déclaration suivante. L’art. 103-6° serait abrogé.", "1er janvier 2027 (art. 7-I)."],
        ["Dépôt bancaire", "Art. 11-II et 106-II : le dépôt serait ajouté aux modes de paiement, à côté du virement. La note le relie à l’art. 193, qui le vise déjà.", "1er janvier 2027 (art. 7-I)."],
        ["Avance de 5 % à l’import", "Art. 170-I et 173-IV : 5 % de la valeur en douane, au dédouanement de marchandises à revendre en l’état. Hors régimes économiques en douane et biens d’investissement.", "Dès le 1er juillet 2027 (art. 7-IV-7)."],
        ["TVA sur la marge", "Art. 90-5°, 96-13° et 125 sexies : option des marchands de biens immeubles bâtis. Base : prix de vente moins prix d’achat et frais d’acquisition, TVA comprise.", "Ventes dès le 1er juillet 2027 (art. 7-IV-9)."],
      ],
    },
    h2("qui-et-quand", "Qui est concerné, et à partir de quand ?"),
    h3("restitution-tva", "La restitution ne vise pas toutes les PME"),
    p("L’article 117-IV vise les fournisseurs de biens d’équipement et de travaux sans attestation de moins de six mois : le client assujetti retient la TVA. L’État, les collectivités territoriales et les personnes morales de droit public tenues aux marchés publics ne retiennent pas. L’article 117-V vise certaines prestations, à 75 % de la taxe, ou 100 % sans attestation. L’article 240 restituerait l’excédent non imputé. La note renvoie le remboursement actuel au décret n° 2-06-574."),
    h3("depot-et-import", "Dépôt bancaire et importateurs"),
    p("Le dépôt alignerait les articles 11-II et 106-II sur l’article 193, sans lever les autres conditions de déduction. L’avance de 5 % viserait les sociétés et les commerçants qui importent pour revendre en l’état. Elle serait versée aux douanes pendant soixante mois, puis seulement sans attestation de moins de six mois, et imputée sur l’impôt avec restitution du surplus."),
    h3("marge", "La TVA sur la marge reste une option"),
    p("La note dit que cette revente n’est pas, hors travaux, lotissement et promotion, dans la TVA actuelle. L’option rendrait déductible la TVA des travaux de restauration, de rénovation ou de réfection, pas celle de l’acquisition. La facture citerait le régime de la marge et l’article 125 sexies."),
    h2("que-faire", "Que faire concrètement ?"),
    p("Ne changez pas vos factures ni vos déclarations sur la foi de ce projet. Repérez si vous êtes visé par les articles 117-IV ou V, si vous payez par dépôt, si vous importez pour revendre en l’état, ou si vous revendez des immeubles bâtis. Conservez factures, attestations et preuves de paiement pour votre expert-comptable."),
    p("Les mentions de facture restent celles de l’article 145. Le ",
      { href: "/blog/modele-facture-maroc-ice", label: "modèle de facture avec ICE" },
      " et la ",
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "checklist des mentions" },
      " décrivent le CGI en vigueur."),
    {
      type: "callout",
      tone: "accountant",
      title: "À vérifier avec votre expert-comptable",
      paragraphs: [[
        "La retenue, la déduction et l’option pour la marge dépendent de votre régime et des pièces détenues. Le projet peut encore changer. Faites relire les articles 117, 11, 106, 170, 173, 240 et 125 sexies sur le texte qui sera, le cas échéant, publié au Bulletin officiel.",
      ]],
    },
    {
      type: "callout",
      tone: "product",
      title: "Avec Felexia",
      paragraphs: [[
        "ESSENTIEL enregistre les factures, les avoirs, les règlements et les journaux, dont le mode de paiement et le solde. Il ne calcule pas la restitution, l’avance de 5 % ni la marge : ces règles ne sont pas en vigueur. PRO prépare le suivi des déclarations de TVA, à valider avec votre conseil. Aucune déclaration n’est transmise à l’administration. ",
        { href: "/logiciel-facturation-maroc", label: "Le logiciel de facturation" },
        " et ",
        { href: "/facturation-electronique-maroc", label: "la facture électronique" },
        " décrivent le quotidien : PDF et XML. Cela ne signifie pas une connexion officielle à la DGI ni une signature électronique qualifiée.",
      ]],
    },
  ],
  questions: [
    {
      question: "Le projet de loi de finances 2027 est-il déjà applicable ?",
      answer: "Non. Le texte consulté le 10 novembre 2026 est le projet n° 60-26, publié par la Chambre des représentants et par le ministère de l’Économie et des Finances. Les documents du ministère sont datés du 23 octobre 2026. Le 29 octobre 2026, la commission des finances de la Chambre en débattait encore. Le projet peut être amendé jusqu’au vote.",
    },
    {
      question: "Toutes les PME pourraient-elles demander la restitution de TVA ?",
      answer: "Non. L’article 240 du projet viserait l’excédent de retenue à la source des articles 117-IV et V, lorsque ce montant ne peut pas être imputé sur la TVA due. Il serait restitué au fournisseur, sur demande, après le trimestre. Les clients qui n’opèrent pas cette retenue ne sont pas dans ce cas.",
    },
    {
      question: "Un dépôt bancaire suffirait-il à déduire une charge ?",
      answer: "Le projet ajouterait le dépôt bancaire aux modes cités aux articles 11-II et 106-II, à côté du virement. La note de présentation précise qu’il ne dispense pas des autres conditions de déduction. La règle ne s’appliquerait, dans le projet, qu’à compter du 1er janvier 2027, et seulement si elle est votée.",
    },
    {
      question: "L’avance de 5 % est-elle un impôt en plus ?",
      answer: "Dans le projet, c’est une avance, au dédouanement, de 5 % de la valeur en douane retenue pour les droits de douane. Elle viserait les marchandises importées pour être revendues en l’état, pas les régimes économiques en douane ni les biens d’investissement. Elle serait imputable sur l’impôt, avec restitution du surplus, pour les importations à compter du 1er juillet 2027 si le texte est adopté ainsi.",
    },
    {
      question: "Faut-il changer les mentions de facture dès maintenant ?",
      answer: "Non pour l’article 145 : il n’est pas dans la liste de l’article 7-I du projet. La mention « Imposition selon le régime de la marge » ne concernerait que les marchands de biens immeubles bâtis ayant opté, et seulement si l’article 125 sexies est adopté. Les factures actuelles suivent le CGI en vigueur.",
    },
    {
      question: "Felexia applique-t-il déjà ces mesures ?",
      answer: "Non. ESSENTIEL enregistre les factures, les règlements et les journaux. PRO prépare le suivi des déclarations de TVA, que votre conseil valide. Aucune de ces fonctions ne dépose une demande de restitution, ne calcule l’avance de 5 % ni ne transmet une déclaration à l’administration.",
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
    { href: "/blog/modele-facture-maroc-ice", label: "Modèle de facture avec ICE" },
    { href: "/blog/facturation-electronique-maroc-etat-des-lieux", label: "Où en est la facture électronique" },
  ],
  sources: [
    { label: "Chambre des représentants — projet de loi de finances n° 60-26 pour l’année budgétaire 2027, texte français", href: "https://www.chambredesrepresentants.ma/sites/default/files/loi/01-%20Projet%20loi%20de%20Finances%202027_Fr.pdf", consulted },
    { label: "Ministère de l’Économie et des Finances — corps du projet de loi de finances 2027, daté du 23 octobre 2026 sur la page du projet. Articles 7-I, 7-II, 7-IV, 11-II, 90-5°, 96-13°, 103-6°, 106-II, 117 (renvoi), 125 sexies, 170-I, 173-IV et 240.", href: "https://www.finances.gov.ma/Publication/db/2027/corps-PLF2027-fr.pdf", consulted },
    { label: "Ministère de l’Économie et des Finances — note de présentation du projet de loi de finances 2027, datée du 23 octobre 2026. Sections TVA, dispositions communes (avance, dépôt bancaire) et marchands de biens.", href: "https://www.finances.gov.ma/Publication/db/2027/Note-presentation_Fr.pdf", consulted },
    { label: "Ministère de l’Économie et des Finances — page Projet de loi de finances 2027, qui liste le corps et la note de présentation au 23 octobre 2026", href: "https://www.finances.gov.ma/fr/vous-orientez/Pages/plf2027.aspx", consulted },
    { label: "Direction générale des impôts — Code général des impôts 2026, articles 117-IV et V, pour la retenue à la source déjà en vigueur", href: "https://www.tax.gov.ma/wps/wcm/connect/08712531-1e81-4e28-a38b-2bd9edf8e09e/CGI+2026+FR.pdf?MOD=AJPERES", consulted },
    { label: "Portail national maroc.ma, 29 octobre 2026 — compte rendu des débats de la commission des finances de la Chambre des représentants sur le projet. Contexte sur l’examen parlementaire, pas une règle fiscale.", href: "https://maroc.ma/fr/actualites/plf-2027-equilibres-budgetaires-et-equite-sociale-dominent-les-debats-de-la-commission-des-finances-la", consulted },
    { label: "Felexia — page Tarifs, pour le prix ESSENTIEL et la durée d’essai", href: "/pricing", consulted },
  ],
  disclaimer: "Contenu informatif, non contractuel. Le projet peut être amendé jusqu’au vote. Vérifiez le texte promulgué auprès de l’administration fiscale ou de votre expert-comptable. Mis à jour le 10 novembre 2026.",
};

export default article;
