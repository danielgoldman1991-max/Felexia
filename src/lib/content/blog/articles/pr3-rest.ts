import type { ArticleSpec } from "@/lib/content/blog/article-shell";
import { pack } from "@/lib/content/blog/articles/pr3-more";

const tutorial = { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel SIMPL-TVA" };
const essentiel = { href: "/essentiel", label: "ESSENTIEL" };

export const REST_SPECS: ArticleSpec[] = [
  pack({
    slug: "if-ice-rc-tp-facture-maroc",
    title: "IF, ICE, RC et TP sur la facture | Felexia",
    description: "IF, ICE, RC et taxe professionnelle : quatre identifiants différents sur une facture au Maroc. Felexia les imprime s’ils sont saisis. Il ne les devine pas.",
    h1: "IF, ICE, RC et taxe professionnelle : que mettre sur la facture",
    category: "facturation",
    alt: "Fond bleu Felexia, sans photo, pour distinguer IF, ICE, RC et taxe professionnelle sur une facture.",
    essentials: [
      "L’ICE saisi dans Felexia doit avoir 15 chiffres, sinon il est refusé.",
      "L’IF du fournisseur est demandé pour préparer une déduction de TVA.",
      "Le RC et l’IF de votre entreprise s’impriment sur le PDF s’ils sont renseignés.",
      "La taxe professionnelle n’est pas calculée par Felexia. Ne la confondez pas avec l’IF.",
    ],
    introduction: [
      "Quatre sigles tiennent parfois sur la même ligne, et ce ne sont pas quatre noms du même numéro. ",
      "L’ICE, déjà détaillé, est dans ",
      { href: "/blog/ice-facture-maroc", label: "ICE sur la facture" },
      ". Les mentions plus larges sont dans ",
      { href: "/blog/mentions-obligatoires-facture-maroc", label: "les mentions de facture" },
      ".",
    ],
    sections: [
      { id: "quatre", title: "Quatre identifiants, quatre rôles", paragraphs: [
        "L’ICE identifie l’entreprise sur 15 chiffres. L’IF est l’identifiant fiscal. Le RC est le registre de commerce. La taxe professionnelle est un impôt local, pas un numéro de facture. Les recopier l’un pour l’autre produit une pièce fausse, même si le total TTC est juste.",
        "Felexia n’interroge pas l’administration pour vérifier que le numéro collé est le bon. Il contrôle surtout la forme : 15 chiffres pour l’ICE, des chiffres pour l’IF quand il entre dans l’export de TVA. Le fond, c’est votre copie depuis le document du tiers.",
      ]},
      { id: "ice", title: "L’ICE, déjà cadré", paragraphs: [
        "Sur la facture PDF, l’ICE de votre entreprise apparaît s’il est dans les paramètres. L’ICE du client apparaît s’il est sur sa fiche. Le guide dédié dit d’où recopier le vôtre, certificat ou bulletin, sans inventer un annuaire des clients.",
        "Un ICE de 14 ou 16 chiffres ne passe pas le contrôle de saisie. Ce n’est pas la preuve que les 15 chiffres sont le bon établissement. Relisez-les, surtout les zéros.",
      ]},
      { id: "if", title: "L’IF, utile pour la déduction", paragraphs: [
        "Pour le relevé de déductions, l’export attend l’IF du fournisseur à côté de son nom et de son ICE. Sans IF numérique, la ligne ne part pas proprement. Le libellé dans le produit est clair : l’IF est requis pour déduire la TVA.",
        "Cela ne dit pas que toute facture d’achat donne droit à déduction. Le droit à déduire, le prorata et les exclusions se confirment avec votre conseil. Felexia met l’IF dans le fichier. Il ne juge pas le droit.",
      ]},
      { id: "rc-tp", title: "RC et taxe professionnelle", paragraphs: [
        "Le RC de votre société se saisit dans les paramètres et peut figurer sur le PDF avec l’IF. Ce n’est pas l’ICE. Une entreprise peut avoir un RC et un ICE différents, et plusieurs établissements. Ne fabriquez pas l’un à partir de l’autre.",
        "Felexia ne calcule pas la taxe professionnelle et ne prépare pas son avis. Si vous devez la payer, le calendrier et l’assiette se lisent auprès de l’administration ou de votre conseil. Ne la mettez pas dans une case TVA pour « la suivre quand même ».",
      ]},
      { id: "pdf", title: "Ce que le PDF montre", paragraphs: [
        "Le PDF reprend ce qui est renseigné : logo, coordonnées, ICE, IF, RC. Une case vide reste vide. Mieux vaut un champ vide qu’un numéro emprunté à un autre document « en attendant ».",
        "Avant d’envoyer la première facture à un client, imprimez un PDF d’essai et comparez-le à vos papiers. Le tutoriel TVA, lui, montre l’IF fournisseur dans le relevé, pas sur la facture de vente.",
      ]},
      { id: "offre", title: "Où saisir", paragraphs: [
        "Les paramètres d’entreprise et les fiches clients ou fournisseurs sont dans ESSENTIEL. Le PDF de facture aussi. PRO ne change pas ces identifiants : il ajoute d’autres parcours.",
        "L’export SIMPL-TVA reprend l’IF et l’ICE des fournisseurs des déductions. Vous déposez ensuite le fichier vous-même.",
      ]},
    ],
    walkthrough: [
      "Prenez une société fictive, appelée ici « Atelier des Dunes ». Elle a un ICE de 15 chiffres recopié d’un papier imaginaire, un IF numérique et un RC différent. Dans Felexia, ces trois valeurs vont dans les paramètres, pas dans une ligne de facture. La taxe professionnelle n’est saisie nulle part, parce que le logiciel ne la calcule pas. Vous créez ensuite un client fictif avec son propre ICE, et un fournisseur fictif avec ICE et IF.",
      "Vous établissez une facture de 1 000 dirhams hors taxe, taux saisi par vous, pas un taux « officiel » de ce guide. Le PDF doit montrer votre ICE, votre IF et votre RC s’ils sont remplis, et l’ICE du client. S’il manque le RC, la case reste vide. Vous ne complétez pas avec l’ICE pour faire joli. Vous imprimez, vous lisez, vous corrigez les paramètres, vous réimprimez.",
      "Côté achat, la facture fournisseur fictive reprend l’IF. Vous préparez une déclaration de test, sans la déposer. L’export du relevé doit contenir cet IF et cet ICE. Si l’IF est une lettre, l’export le refuse. Vous corrigez la fiche, pas le fichier. Ce test se fait sur une période que vous n’enverrez pas à SIMPL.",
      "Quand le PDF et l’export de test sont justes, seulement alors vous passez à de vraies pièces. Les numéros réels ne se mettent pas dans un guide, un e-mail de démonstration ou une capture publiée. Le tutoriel TVA déjà en ligne utilise une société de test pour la même raison. Le dépôt, le jour venu, reste le vôtre.",
    ],
    notes: [
      "Demandez les numéros au tiers, sur son document, plutôt que sur une carte de visite ancienne. Un chiffre transposé se répète sur toutes les factures suivantes.",
      "Ne publiez pas ces numéros dans un exemple réel. Les guides Felexia utilisent des sociétés fictives. Faites de même dans vos captures.",
      "Si vous ne savez pas si la taxe professionnelle doit apparaître sur votre facture, ne l’ajoutez pas au hasard. La question se pose à votre conseil, pas dans une case libre.",
    ],
    practice: [
      "Ouvrez les paramètres et comparez ICE, IF et RC à vos documents.",
      "Ouvrez trois fiches fournisseurs et vérifiez l’IF avant une déclaration.",
      "Éditez un PDF d’essai et lisez l’en-tête à voix haute.",
      "Ne calculez pas la taxe professionnelle dans une ligne de TVA.",
      "Gardez le guide ICE pour le détail du numéro à 15 chiffres.",
    ],
    example: {
      title: "Fiche fictive, quatre cases",
      note: "Numéros inventés, volontairement trop courts pour ne pas ressembler à un vrai ICE.",
      rows: [
        { label: "ICE", value: "15 chiffres à recopier", annotation: "Contrôle de longueur dans Felexia." },
        { label: "IF", value: "Identifiant fiscal", annotation: "Requis pour une déduction dans l’export." },
        { label: "RC", value: "Registre de commerce", annotation: "Imprimé s’il est saisi. Distinct de l’ICE." },
        { label: "TP", value: "Non calculée", annotation: "Ce n’est pas une case de TVA." },
      ],
    },
    checklist: ["ICE sur 15 chiffres.", "IF fournisseur numérique pour le relevé.", "RC non confondu avec l’ICE.", "Taxe professionnelle non inventée dans une ligne.", "PDF d’essai relu."],
    questions: [
      { question: "Felexia vérifie-t-il l’ICE auprès de l’administration ?", answer: "Non. Il vérifie qu’il y a 15 chiffres. Le bon numéro se recopie depuis le document du tiers ou le vôtre." },
      { question: "Pourquoi l’IF est-il à côté de l’ICE sur un achat ?", answer: "L’export du relevé de déductions les attend ensemble. Sans IF exploitable, la ligne ne se prépare pas comme une déduction." },
      { question: "La taxe professionnelle est-elle sur la facture Felexia ?", answer: "Seulement si vous l’avez saisie quelque part à la main. Le logiciel ne la calcule pas et ne la déclare pas." },
      { question: "Où voir le détail de l’ICE ?", answer: "Dans le guide ICE sur la facture, qui renvoie aux pages officielles qu’il a lues, avec sa date." },
    ],
    related: [tutorial, { href: "/blog/ice-facture-maroc", label: "ICE sur la facture" }, { href: "/blog/mentions-obligatoires-facture-maroc", label: "Mentions de facture" }, { href: "/logiciel-facturation-maroc", label: "Logiciel de facturation" }, essentiel],
  }),
  pack({
    slug: "facture-acompte-maroc",
    title: "Facture d’acompte au Maroc | Felexia",
    description: "Facture d’acompte au Maroc : constater la somme reçue, puis la déduire de la facture finale. Le traitement de TVA se confirme avec votre conseil.",
    h1: "Facture d’acompte : encaisser avant la facture définitive, sans compter deux fois",
    category: "facturation",
    alt: "Fond bleu Felexia, sans photo, pour expliquer une facture d’acompte distincte de la facture finale.",
    essentials: [
      "Felexia peut établir une facture de vente pour le montant de l’acompte, avec son numéro.",
      "La facture finale ne doit pas reprendre cet acompte une seconde fois sans l’éteindre.",
      "Un avoir ou une mention claire relie les deux pièces. Le numéro d’origine ne se réutilise pas.",
      "Le sort de la TVA sur l’acompte se confirme avec votre conseil. Ce guide ne fixe pas de règle.",
    ],
    introduction: ["Un acompte est une somme reçue avant la fin de la vente. La facture qui le constate n’est pas, à elle seule, la facture de toute la prestation. Le lien avec la pièce finale se prépare tout de suite, pas le jour de l’export TVA."],
    sections: [
      { id: "deux-pieces", title: "Deux pièces, deux numéros", paragraphs: [
        "Vous émettez une facture pour l’acompte, avec le client, le montant et la TVA que vous avez décidé d’appliquer après avis. Plus tard, la facture de solde ou la facture globale montre le total et déduit l’acompte déjà facturé. Deux numéros existent. Aucun n’est effacé.",
        "Réécrire la première facture pour en faire la finale casse la série. Le guide sur l’avoir explique pourquoi un numéro émis reste. Ici, le même principe s’applique : on ajoute une pièce, on n’en recycle pas une.",
      ]},
      { id: "tva", title: "La TVA n’est pas tranchée par le logiciel", paragraphs: [
        "Felexia calcule la TVA du taux que vous saisissez sur les lignes. Il ne sait pas si l’acompte de votre métier se taxe tout de suite ou plus tard. Cette question se pose à votre conseil, avec votre activité, avant d’enregistrer la première pièce.",
        "Une fois le taux choisi et saisi, l’export SIMPL-TVA reprendra les factures selon le régime d’encaissement ou de débits. Un acompte encaissé et une facture de solde encaissée plus tard peuvent tomber dans deux périodes. C’est voulu si le régime suit les paiements.",
      ]},
      { id: "solde", title: "Le solde, sans double compte", paragraphs: [
        "Sur la facture finale fictive, le total du marché s’affiche, puis une ligne négative ou un avoir relie l’acompte déjà facturé. Le client ne paie pas deux fois. La comptabilité ne doit pas non plus compter deux fois le même chiffre d’affaires.",
        "Si vous vous êtes trompé, un avoir sur l’acompte ou sur la finale remet les montants d’équerre. Vous ne supprimez pas la facture pour « recommencer propre ». Le numéro reste dans la série.",
      ]},
      { id: "devis", title: "Le devis n’est pas l’acompte", paragraphs: [
        "Le devis, dans PRO, décrit la proposition. Il n’encaisse rien et ce n’est pas une facture numérotée d’ESSENTIEL. L’acompte, lui, est une facture de vente si vous décidez de facturer la somme reçue.",
        "Enchaîner devis, commande, puis facture d’acompte est un parcours PRO pour le devis, et ESSENTIEL pour la facture. Ne promettez pas un devis dans l’offre de facturation seule.",
      ]},
      { id: "export", title: "Et la déclaration", paragraphs: [
        "Les factures d’acompte et de solde entrent dans la déclaration comme les autres factures de vente, selon le régime. Vous préparez le XML et vous le déposez vous-même. Felexia ne verse pas la TVA.",
        "Si l’acompte et le solde se chevauchent dans vos totaux, le contrôle d’export ne devine pas l’erreur commerciale. Relisez le net à payer du client avant de produire le fichier.",
      ]},
      { id: "offre", title: "Où cliquer", paragraphs: [
        "Nouvelle facture client, lignes, validation, PDF. Le règlement de l’acompte se rattache à cette facture. Le solde se rattache à la facture finale. Deux règlements, deux pièces.",
        "ESSENTIEL couvre la facture et le règlement. PRO sert si le devis et la commande doivent précéder. Le prix affiché d’ESSENTIEL est celui de la page Tarifs.",
      ]},
    ],
    walkthrough: [
      "La société fictive « Jardin Riad » vend une prestation de 12 000 dirhams hors taxe, taux saisi par elle. Elle demande 4 000 hors taxe avant de commencer. Elle établit la facture FAC-AC-1 pour ces 4 000, l’encaisse, et rattache le règlement. Ce n’est pas encore toute la vente.",
      "À la fin, elle établit FAC-AC-2 pour 12 000, avec une ligne qui déduit les 4 000 déjà facturés. Le client paie le solde. Les deux PDF restent. Les numéros ne sont pas réutilisés. Les montants sont inventés.",
      "Selon le régime, mars peut contenir l’acompte et avril le solde, ou les deux factures suivent leur date. Elle ne change pas le régime entre les deux pour faire entrer les montants dans le même mois.",
      "Elle prépare l’export de test sans le déposer. Elle vérifie que le chiffre d’affaires n’est pas 16 000. S’il l’est, la déduction de l’acompte a été oubliée. Elle corrige par un avoir ou une ligne, puis elle régénère. Le dépôt SIMPL viendra après, de sa main. Elle conserve les deux PDF dans le dossier du client fictif, avec la date d’encaissement de chaque règlement, pour pouvoir expliquer le pont entre les deux pièces à son conseil.",
    ],
    notes: [
      "Ne présentez pas l’acompte comme une règle unique pour tout le Maroc. Les métiers ne se traitent pas tous de la même façon. Le conseil prime.",
      "Un paiement sans facture laisse une somme en banque et rien dans la série des factures. Décidez d’abord si vous facturez l’acompte.",
      "Le parcours de facture électronique archive la version émise. Il ne remplace pas ce lien entre acompte et solde, et il n’envoie rien à la DGI.",
    ],
    practice: ["Décider avec le conseil si l’acompte est facturé.", "Émettre la facture d’acompte et encaisser dessus.", "Émettre la finale en déduisant l’acompte.", "Contrôler que le total n’est pas doublé.", "Déposer la TVA vous-même, plus tard."],
    example: { title: "Jardin Riad, deux factures", note: "Société et montants fictifs.", rows: [
      { label: "Acompte", value: "4 000 HT facturés", annotation: "Numéro propre, règlement rattaché." },
      { label: "Finale", value: "12 000 HT moins 4 000", annotation: "Le client paie le solde." },
      { label: "Erreur à éviter", value: "Compter 16 000", annotation: "Oubli de la déduction." },
    ]},
    checklist: ["Conseil consulté sur la TVA de l’acompte.", "Deux numéros distincts.", "Solde net relu.", "Régime inchangé entre les deux sans raison.", "Export non déposé tant que le total est faux."],
    questions: [
      { question: "Felexia a-t-il un bouton « acompte » à part ?", answer: "Vous établissez une facture de vente pour le montant reçu, puis une facture de solde qui le déduit. Il n’y a pas un troisième type magique qui compterait à votre place." },
      { question: "La TVA de l’acompte est-elle toujours due tout de suite ?", answer: "Ce guide ne le dit pas. Le taux et le moment se confirment avec votre conseil. Felexia applique le taux que vous saisissez." },
      { question: "Puis-je réutiliser le numéro de l’acompte pour la finale ?", answer: "Non. Chaque facture émise garde son numéro. La finale a le sien." },
      { question: "L’acompte part-il à la DGI tout seul ?", answer: "Non. Il peut entrer dans la déclaration préparée. Le dépôt sur SIMPL reste le vôtre." },
    ],
    related: [tutorial, { href: "/blog/avoir-facture-maroc", label: "Avoir et numérotation" }, { href: "/logiciel-devis-facture-maroc", label: "Devis et factures" }, { href: "/blog/tva-encaissement-ou-debits-maroc", label: "Encaissement ou débits" }, essentiel],
  }),
];

export const REST_SPECS_EXTRA: ArticleSpec[] = [];
