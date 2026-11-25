import type { ArticleSpec } from "@/lib/content/blog/article-shell";
import { pack } from "@/lib/content/blog/articles/pr3-more";

const tutorial = { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel SIMPL-TVA" };
const essentiel = { href: "/essentiel", label: "ESSENTIEL" };
const pro = { href: "/pro", label: "PRO" };
const paie = { href: "/logiciel-paie-maroc", label: "Paie PRO" };
const compta = { href: "/logiciel-comptabilite-maroc", label: "Comptabilité" };
const q = (question: string, answer: string) => ({ question, answer });

const notes = [
  "Les exemples sont fictifs. N’y mettez pas un vrai salaire, un vrai ICE ou un vrai numéro CNSS.",
  "Felexia prépare des états. Il ne dépose pas la TVA sur SIMPL, ne génère pas Damancom et n’active pas la connexion DGI.",
  "Un taux, un délai ou un formulaire officiel se vérifie le jour du dépôt, avec le portail ou votre conseil.",
];
const practice = ["Saisir les pièces dans Felexia.", "Relire.", "Produire le PDF ou l’export.", "Ne pas confondre fichier et dépôt.", "Ranger la période."];

function art(partial: Omit<ArticleSpec, "notes" | "practice" | "disclaimer">): ArticleSpec {
  return pack({ ...partial, notes, practice });
}

const bridge = " Le tutoriel de déclaration TVA reste le guide de l’export XML, et le dépôt sur SIMPL reste un geste de l’entreprise, distinct de la paie comme de la facture. Aucune page de ce site ne doit être lue comme un accusé de l’administration. Avant de vous appuyer sur un chiffre, vérifiez qu’il sort de vos pièces et non d’un souvenir. Un taux recopié d’un vieux message, une date supposée, un numéro de formulaire deviné : aucun de ces réflexes n’est repris ici. Le portail du jour et votre conseil corrigent ce que ce guide laisse ouvert. Rangez ensuite le fichier avec la période, le nom de la personne qui l’a préparé et le fait qu’il n’a pas encore été déposé, ou qu’il l’a été par vous, hors Felexia. Si deux personnes préparent le même mois, elles se mettent d’accord sur une seule version avant tout envoi. Deux fichiers du même nom ne doivent pas circuler. Notez aussi ce que vous n’avez pas fait : pas de dépôt, pas de taux affirmé, pas de connexion à l’administration. Cette liste négative évite de prendre le guide pour un récépissé.";

export const TAIL_SPECS: ArticleSpec[] = [
  art({
    slug: "facture-excel-ou-logiciel-maroc",
    title: "Facture Excel ou logiciel au Maroc | Felexia",
    description: "Excel ou un logiciel de facturation au Maroc : numérotation, ICE, TVA et historique. Felexia décrit ce qu’il fait, sans classement ni note inventée.",
    h1: "Excel ou un logiciel de facturation : des critères, pas un classement",
    category: "choix-logiciel",
    alt: "Fond bleu Felexia, sans photo, pour comparer un tableur et un logiciel de facturation sans classement.",
    essentials: ["Un tableur ne tient pas seul une série de numéros déjà émis.", "Felexia numérote, imprime l’ICE saisi et prépare la TVA.", "Aucun classement et aucun volume de clients ne sont annoncés.", "Le dépôt SIMPL et la connexion DGI ne font pas partie du tableur ni du logiciel."],
    introduction: ["La question n’est pas de désigner un gagnant. Elle est de voir ce qu’un fichier tableur oublie quand plusieurs personnes facturent, et ce qu’un logiciel tient à votre place, sans promesse de palmarès."],
    sections: [
      { id: "criteres", title: "Des critères concrets", paragraphs: ["Le numéro suivant, l’ICE sur 15 chiffres, le HT et la TVA saisis, le solde après règlement, l’avoir qui ne réutilise pas un numéro. Ce sont des gestes quotidiens.", "Un tableur peut les imiter le premier mois. Il devient fragile quand deux personnes enregistrent, ou quand une ligne est écrasée."] },
      { id: "logiciel", title: "Ce que Felexia tient", paragraphs: ["ESSENTIEL facture, encaisse, tient les journaux et prépare la déclaration avec l’export XML. PRO ajoute devis, stock et paie préparatoire.", "Le prix ESSENTIEL est celui des tarifs publics. PRO est sur devis. Rien d’autre n’est inventé ici."] },
      { id: "pas", title: "Ce qu’aucun des deux ne dépose", paragraphs: ["Ni Excel ni Felexia ne valident votre déclaration sur SIMPL. Vous le faites. La facture électronique de Felexia archive un PDF et un XML. Elle n’est pas connectée à la DGI.", "Ne croyez pas un comparatif qui promet « zéro rejet » ou une place de numéro un. Ce site n’en publie pas."] },
      { id: "equipe", title: "Plusieurs personnes", paragraphs: ["Avec un fichier, le dernier qui enregistre gagne. Avec le logiciel, les droits dépendent du rôle. Un lecteur ne modifie pas. C’est déjà un critère, sans chiffre d’utilisateurs inventé au-delà des limites publiées.", "Jusqu’à trois utilisateurs dans ESSENTIEL, jusqu’à vingt-cinq dans PRO. Au-delà, ce n’est pas une promesse de cette page."] },
      { id: "reprise", title: "Reprendre l’historique", paragraphs: ["Vous pouvez importer des clients depuis un CSV ouvert par Excel, avec contrôle de l’ICE. Ce n’est pas un import de toutes les vieilles factures du monde.", "Les factures nouvelles naissent dans Felexia. Les anciennes restent vos archives, à conserver selon les règles que votre conseil vous rappelle."] },
      { id: "choix", title: "Comment choisir sans slogan", paragraphs: ["Si vous facturez seul et que la série ne casse pas, le tableur peut encore suffire. Dès que la TVA, l’ICE et les règlements se dispersent, le logiciel décrit ici couvre ce quotidien.", "Essayez ESSENTIEL sans carte, sur vos propres pièces fictives d’abord. Ne migrez pas un mois déjà déposé au milieu de la déclaration."] },
    ],
    walkthrough: ["La société fictive « Tableur & Co » a deux versions du même classeur. L’une a sauté le numéro 14. L’autre a un ICE de 14 chiffres. Personne ne sait laquelle est partie au client.", "Dans Felexia, le numéro suivant est unique, l’ICE trop court est refusé, le PDF reprend l’en-tête saisi. Le règlement se rattache à la facture.", "L’export de TVA se prépare ensuite. Il n’est pas déposé dans l’exemple. Le tableur n’a pas produit ce XML." + bridge],
    example: { title: "Deux classeurs, une série", note: "Fiction.", rows: [
      { label: "Tableur", value: "Numéro 14 manquant", annotation: "Deux fichiers divergent." },
      { label: "Logiciel", value: "Série continue", annotation: "ICE contrôlé à la saisie." },
      { label: "Dépôt", value: "Toujours manuel", annotation: "SIMPL n’est pas dans le tableur." },
    ]},
    checklist: ["Pas de slogan de premier du marché.", "Série et ICE testés.", "Prix lus sur la page Tarifs.", "Import clients seulement.", "Déclaration non automatique."],
    questions: [
      q("Felexia est-il le meilleur logiciel ?", "Ce guide ne le dit pas et ne publie pas de note. Il décrit la numérotation, l’ICE, la TVA et les offres."),
      q("Puis-je importer mes factures Excel ?", "L’import prévu ici est celui des clients et fournisseurs via CSV. Ce n’est pas un reprise universelle de toutes les factures."),
      q("Le tableur envoie-t-il la TVA ?", "Non. Felexia non plus. Vous déposez le XML sur SIMPL."),
      q("Où voir le prix ?", "Sur la page Tarifs. ESSENTIEL a un prix public. PRO est sur devis."),
    ],
    related: [tutorial, { href: "/pricing", label: "Tarifs" }, { href: "/blog/numerotation-facture-maroc", label: "Numérotation" }, { href: "/blog/gestion-stock-excel-maroc", label: "Stock sur Excel" }, essentiel, pro],
  }),
  artPaie(),
];

function artPaie(): ArticleSpec {
  return art({
    slug: "paie-cnss-amo-ir-maroc",
    title: "Paie CNSS, AMO et IR au Maroc | Felexia",
    description: "Paie au Maroc : bulletins, CNSS, AMO et IR préparés dans Felexia PRO. Aucun taux n’est donné ici. Les dépôts CNSS et Damancom restent les vôtres.",
    h1: "Paie, CNSS, AMO et IR : paramétrer sans prendre un taux pour acquis",
    category: "profils-secteurs",
    alt: "Fond bleu Felexia, sans photo, pour la paie préparatoire CNSS, AMO et IR, sans taux inventé.",
    essentials: ["La paie est dans PRO, pas dans ESSENTIEL.", "Les bulletins se préparent à partir des éléments saisis et des paramètres.", "Le bordereau CNSS téléchargé est préparatoire. Ce n’est pas Damancom.", "Aucun taux de cotisation n’est affirmé dans ce guide."],
    introduction: ["Les taux de CNSS, d’AMO et d’IR bougent et dépendent du cas. Les recopier de mémoire dans un article les figerait à tort. Felexia calcule avec les paramètres enregistrés. Votre conseil vérifie qu’ils sont ceux du moment."],
    sections: [
      { id: "perimetre", title: "Ce qui est dans PRO", paragraphs: ["Fiches salariés, contrats, périodes de paie, bulletin de base et bulletin plus complet : primes, ancienneté, heures supplémentaires, indemnités, avances. Le PDF du bulletin se consulte.", "ESSENTIEL ne contient pas ce module. L’essai ne l’ouvre pas."] },
      { id: "cnss", title: "CNSS et AMO, en préparation", paragraphs: ["L’écran liste des éléments et signale un numéro CNSS qui n’a pas 9 chiffres. Vous téléchargez un texte de bordereau marqué préparatoire.", "Ce fichier n’est pas déposé. Damancom, le téléservice, se fait avec vos accès, hors Felexia."] },
      { id: "ir", title: "L’IR du salaire", paragraphs: ["Un montant d’IR est estimé selon les paramètres. Un état 9421 préparatoire cumule la base imposable et l’IR retenu sur l’année. Ce n’est pas le dépôt EDI.", "Ne publiez pas un barème ici. Ouvrez la référence du moment avec votre conseil ou le texte officiel en vigueur."] },
      { id: "pas", title: "Ce qui n’est pas un cycle complet", paragraphs: ["Les congés, présences et notes de frais ne forment pas à eux seuls un circuit d’approbation achevé. La page PRO le dit déjà.", "Felexia ne paie pas le salarié à votre place et ne verse rien à la CNSS."] },
      { id: "param", title: "Quoi paramétrer", paragraphs: ["Le salaire de base, le numéro CNSS, la période, les éléments variables que vous décidez d’ajouter. Chaque élément se relit avant de figer le bulletin.", "Si un paramètre est faux, tous les bulletins du mois le seront. Le contrôle est humain."] },
      { id: "offre", title: "Demander PRO", paragraphs: ["PRO est sur devis. Le bouton de la page ouvre un e-mail que vous envoyez. Indiquez le nombre de salariés, sans coller leurs données dans le message.", "La facturation et la TVA restent dans ESSENTIEL, y compris si vous n’avez pas encore la paie."] },
    ],
    walkthrough: ["La société fictive « Atelier Lime » a deux salariés inventés, salaires ronds, numéros CNSS de démonstration de 9 chiffres. Elle ouvre mars. Elle prépare les bulletins. Elle ne les appelle pas « officiels ».", "Elle télécharge le bordereau préparatoire et le range à côté des bulletins. Elle ne le dépose pas. Elle n’a pas de fichier Damancom issu de Felexia.", "L’IR affiché est celui du paramètre, pas un taux cité par cet article. Le conseil fictif de l’exemple devrait le relire. Le vrai conseil, le vôtre, aussi, hors du logiciel, avant paiement." + bridge],
    example: { title: "Atelier Lime, mars fictif", note: "Aucun salarié réel.", rows: [
      { label: "Bulletins", value: "Préparés", annotation: "PRO." },
      { label: "CNSS", value: "Texte préparatoire", annotation: "Pas un dépôt." },
      { label: "Taux", value: "Non cités", annotation: "Paramètres à vérifier." },
    ]},
    checklist: ["PRO confirmé.", "Numéros CNSS relus.", "Aucun taux recopié d’un article.", "Bordereau non déposé depuis Felexia.", "Conseil sollicité avant paiement."],
    questions: [
      q("Quels sont les taux CNSS en vigueur ?", "Ce guide ne les donne pas. Ils se vérifient auprès de la CNSS et de votre conseil, puis se paramètrent."),
      q("Felexia dépose-t-il la CNSS ?", "Non. Le fichier téléchargé est préparatoire. Le dépôt est le vôtre."),
      q("La paie est-elle dans l’essai ESSENTIEL ?", "Non. Elle est dans PRO, sur devis."),
      q("L’état 9421 est-il l’EDI ?", "Non. C’est un cumul préparatoire. Le dépôt officiel se fait ailleurs."),
    ],
    related: [tutorial, paie, pro, { href: "/blog/fichier-damancom-dns-bds", label: "Damancom et BDS" }, { href: "/blog/etat-9421-traitements-salaires", label: "État 9421" }],
  });
}

export const MORE_TAIL: ArticleSpec[] = [
  art({
    slug: "fichier-damancom-dns-bds",
    title: "Damancom, DNS et BDS : le rôle de Felexia",
    description: "Damancom, DNS et BDS : Felexia télécharge un bordereau préparatoire, pas un fichier de dépôt. La télé-déclaration CNSS reste faite par l’entreprise.",
    h1: "Fichier Damancom, DNS et BDS : ce que Felexia prépare, et ce qu’il ne génère pas",
    category: "profils-secteurs",
    alt: "Fond bleu Felexia, sans photo, pour distinguer un BDS préparatoire d’un dépôt Damancom.",
    essentials: ["Il existe un téléchargement de bordereau de salaires marqué préparatoire.", "Felexia ne génère pas le fichier Damancom et ne décrit pas ici le format DNS officiel.", "Le dépôt se fait avec vos accès, hors du logiciel.", "Aucun mode d’emploi des écrans Damancom n’est recopié."],
    introduction: ["Ces trois noms circulent ensemble, et on les prend parfois pour un seul bouton. Dans Felexia, un seul geste existe : un texte préparatoire. Le reste est le téléservice, que vous ouvrez vous-même."],
    sections: [
      { id: "noms", title: "Trois noms, pas un bouton", paragraphs: ["Le BDS est un bordereau de salaires. DNS et Damancom relèvent de la déclaration sociale en ligne. Ce guide ne détaille pas leur format du jour : il change, et le recopier de mémoire serait faux.", "Vous confirmez le fichier attendu sur le service officiel ou avec votre conseil. Felexia ne le devine pas."] },
      { id: "fichier", title: "Le fichier qui existe", paragraphs: ["Depuis la paie PRO, vous téléchargez un texte dont l’en-tête dit qu’il est préparatoire, avec la période, le numéro CNSS, le nom et des montants issus des bulletins.", "Ce n’est pas un dépôt. Le libellé à l’écran le dit : ce n’est pas Damancom."] },
      { id: "pas", title: "Ce qui n’existe pas", paragraphs: ["Pas de générateur Damancom. Pas d’envoi CNSS. Pas de reçu récupéré dans Felexia.", "Si un prestataire vous promet le contraire au nom de Felexia, ce n’est pas ce que le produit fait."] },
      { id: "usage", title: "À quoi sert quand même le texte", paragraphs: ["Il aide à relire les salaires du mois avant de saisir ou d’importer ailleurs, selon ce que votre conseil utilise. Ce n’est pas une instruction d’import.", "Gardez-le avec les bulletins. Ne le renommez pas en fichier officiel."] },
      { id: "donnees", title: "Les données", paragraphs: ["Un numéro CNSS qui n’a pas 9 chiffres est signalé. Corrigez la fiche. Ne forcez pas un chiffre pour faire taire l’alerte.", "Les montants viennent des bulletins préparés. S’ils sont faux, le texte l’est aussi."] },
      { id: "offre", title: "PRO seulement", paragraphs: ["ESSENTIEL ne contient pas la paie. PRO se demande sur devis.", "La TVA, elle, se prépare dans ESSENTIEL et se dépose à part sur SIMPL. Les deux dépôts ne se mélangent pas."] },
    ],
    walkthrough: ["L’atelier fictif télécharge le texte de mars, le lit, et le pose dans un dossier « à ne pas déposer tel quel ». Il n’ouvre pas Damancom depuis Felexia, parce que ce lien n’existe pas.", "Le conseil, dans la fiction, dira quel canal utiliser. Le vrai conseil fera de même. Aucun écran Damancom n’est décrit ici. Le format DNS n’est pas non plus reproduit : le demander au conseil évite un modèle périmé." + bridge],
    example: { title: "Un texte, pas un dépôt", note: "Fiction.", rows: [
      { label: "Téléchargé", value: "BDS préparatoire", annotation: "En-tête explicite." },
      { label: "Absent", value: "Fichier Damancom", annotation: "Non généré." },
      { label: "Dépôt", value: "Hors Felexia", annotation: "Accès de l’entreprise." },
    ]},
    checklist: ["Texte lu comme préparatoire.", "Pas de format DNS inventé.", "CNSS à 9 chiffres relus.", "PRO seulement.", "Conseil avant envoi."],
    questions: [
      q("Felexia crée-t-il le fichier Damancom ?", "Non. Il propose un bordereau préparatoire. Le dépôt en ligne est le vôtre."),
      q("Le guide explique-t-il les écrans Damancom ?", "Non. Ils se lisent sur le service, le jour où vous déclarez."),
      q("DNS et BDS sont-ils le même fichier ?", "Ce guide ne les confond pas et ne décrit pas le format officiel. Demandez le fichier attendu à votre conseil."),
      q("Cela dépose-t-il la TVA ?", "Non. La TVA est un autre export, SIMPL, également déposé par vous."),
    ],
    related: [tutorial, paie, pro, { href: "/blog/paie-cnss-amo-ir-maroc", label: "Paie CNSS AMO IR" }, { href: "/blog/bulletin-paie-maroc-mentions", label: "Bulletin" }],
  }),
];

export const END_SPECS: ArticleSpec[] = [
  art({
    slug: "etat-9421-traitements-salaires",
    title: "État 9421 : ce que Felexia prépare",
    description: "État 9421 préparatoire : Felexia cumule la base imposable et l’IR retenu des bulletins. Ce n’est pas le dépôt EDI. Aucun barème n’est cité ici.",
    h1: "État 9421 des traitements et salaires : un cumul préparatoire, pas un dépôt",
    category: "profils-secteurs",
    alt: "Fond bleu Felexia, sans photo, pour l’état 9421 préparatoire des traitements et salaires.",
    essentials: ["Un téléchargement prépare un cumul annuel de base imposable et d’IR retenu.", "Ce n’est pas le fichier EDI officiel.", "Les montants viennent des bulletins. S’ils sont faux, le cumul l’est.", "Aucun barème légal n’est recopié dans ce guide."],
    introduction: ["L’état 9421 sert, dans la vie réelle, à déclarer des traitements. Ici, on décrit seulement le cumul que Felexia sait sortir des bulletins déjà préparés, et on s’arrête avant le dépôt."],
    sections: [
      { id: "quoi", title: "Ce que le fichier contient", paragraphs: ["Le texte indique l’année, puis des lignes issues des bulletins : de quoi relire une base et un IR. L’en-tête dit que c’est préparatoire.", "Il ne reprend pas, dans ce guide, la liste officielle des cases. Cette liste se lit sur le formulaire en vigueur."] },
      { id: "pas", title: "Ce que ce n’est pas", paragraphs: ["Ce n’est pas un dépôt. Felexia ne transmet pas l’état. Vous, ou votre conseil, le faites selon le canal du moment.", "Ce n’est pas non plus une validation que l’IR calculé est le bon. Le paramètre peut être en retard."] },
      { id: "source", title: "D’où viennent les chiffres", paragraphs: ["Des bulletins de l’année. Un bulletin non préparé n’apparaît pas. Un salarié fictif de test ne doit pas rester dans un fichier réel.", "Corrigez le bulletin, pas le texte téléchargé."] },
      { id: "annee", title: "L’année", paragraphs: ["Vous choisissez l’année du téléchargement. Une mauvaise année mélange deux exercices. Notez-la dans le nom du fichier.", "Ne déduisez pas de ce guide une date limite de dépôt. Elle se vérifie auprès de l’administration."] },
      { id: "lien", title: "Lien avec la paie", paragraphs: ["Sans paie PRO, il n’y a pas ces bulletins. ESSENTIEL ne prépare pas l’état.", "Le bordereau mensuel CNSS et l’état annuel sont deux préparations distinctes. Aucune n’est un dépôt."] },
      { id: "conseil", title: "Avant d’envoyer quoi que ce soit", paragraphs: ["Faites relire le cumul. Comparez-le à vos bulletins, pas à un barème trouvé en ligne et non daté.", "Le tutoriel TVA est un autre sujet : ne mélangez pas l’IR salarial et la TVA dans le même fichier."] },
    ],
    walkthrough: ["Deux salariés fictifs, une année fictive. Le cumul affiche la somme des bases et des IR des bulletins préparés. Personne ne le dépose. Le conseil fictif le compare aux bulletins. Écart : un bulletin oublié. On le prépare, on retélécharge." + bridge],
    example: { title: "Cumul fictif", note: "Pas un formulaire officiel.", rows: [
      { label: "Source", value: "Bulletins PRO", annotation: "Préparatoires." },
      { label: "Sortie", value: "Texte 9421 préparatoire", annotation: "Pas l’EDI." },
      { label: "Dépôt", value: "Hors Felexia", annotation: "Date à vérifier ailleurs." },
    ]},
    checklist: ["Année relue.", "Bulletins complets.", "Pas de barème inventé.", "Pas de dépôt depuis Felexia.", "TVA non mélangée."],
    questions: [
      q("Felexia dépose-t-il l’état 9421 ?", "Non. Il prépare un cumul. Le dépôt officiel est le vôtre."),
      q("Les cases du formulaire officiel sont-elles listées ?", "Non. Elles se lisent sur le formulaire en vigueur, pas dans cet article."),
      q("Faut-il PRO ?", "Oui pour les bulletins qui alimentent le cumul. ESSENTIEL ne fait pas la paie."),
      q("Où est la TVA ?", "Dans un autre export, SIMPL, déposé par vous. Le tutoriel le montre."),
    ],
    related: [tutorial, paie, pro, { href: "/blog/paie-cnss-amo-ir-maroc", label: "Paie CNSS AMO IR" }, compta],
  }),
  art({
    slug: "bulletin-paie-maroc-mentions",
    title: "Bulletin de paie : ce que Felexia montre",
    description: "Bulletin de paie au Maroc : Felexia PRO affiche la période, le brut, le net et les retenues calculées. La liste légale se confirme avec votre conseil.",
    h1: "Mentions du bulletin de paie : ce que le bulletin Felexia montre vraiment",
    category: "profils-secteurs",
    alt: "Fond bleu Felexia, sans photo, pour les mentions réellement présentes sur un bulletin préparatoire.",
    essentials: ["Le bulletin préparatoire montre le salarié, la période, la base, le brut et le net selon le calcul.", "Felexia ne publie pas ici la liste légale exhaustive des mentions.", "Le PDF n’est pas une déclaration sociale.", "La paie est dans PRO."],
    introduction: ["Un bulletin utile se lit. Un article qui inventerait toutes les mentions obligatoires vieillirait au premier texte nouveau. On décrit donc l’écran, et on renvoie le reste au conseil."],
    sections: [
      { id: "ecran", title: "Ce qui est affiché", paragraphs: ["Identité du salarié saisie, période, salaire de base, brut, net à payer, et les retenues que le calcul a produites à partir des paramètres.", "Si vous avez ajouté une prime ou une avance, elle apparaît parce que vous l’avez saisie, pas parce que la loi est résumée dans le logiciel."] },
      { id: "pas", title: "Ce qui n’est pas promis", paragraphs: ["La liste complète des mentions du code du travail n’est pas reproduite. Elle se vérifie avec un conseil social.", "Le bulletin n’est pas « certifié ». Il est préparatoire, à valider avant paiement."] },
      { id: "fige", title: "Avant et après validation", paragraphs: ["Tant que la période n’est pas figée, vous corrigez. Après validation, les montants restent ceux enregistrés.", "On ne réécrit pas un bulletin payé en silence. On documente la correction."] },
      { id: "cnss", title: "Lien CNSS et IR", paragraphs: ["Les montants du bulletin alimentent le bordereau préparatoire et, sur l’année, le cumul 9421 préparatoire.", "Aucun de ces fichiers n’est déposé par Felexia."] },
      { id: "donnees", title: "Données personnelles", paragraphs: ["Un bulletin réel ne se met pas dans un e-mail de test ni dans une capture publique.", "Les exemples de ce site sont fictifs."] },
      { id: "offre", title: "Offre", paragraphs: ["PRO seulement, sur devis. ESSENTIEL facture et prépare la TVA, pas la paie.", "Le PDF du bulletin se télécharge depuis la fiche, pour vos archives, pas pour l’administration."] },
    ],
    walkthrough: ["Salarié fictif, mars, base ronde, une prime saisie, une avance. Le bulletin montre le brut et le net calculés. On le lit. On ne le dépose pas. On ne le publie pas." + bridge],
    example: { title: "Un bulletin fictif", note: "Aucun salaire réel.", rows: [
      { label: "Période", value: "Mars", annotation: "Fictive." },
      { label: "Contenu", value: "Base, prime, avance", annotation: "Saisis, pas devinés." },
      { label: "Statut", value: "Préparatoire", annotation: "Pas une déclaration." },
    ]},
    checklist: ["Mentions légales non inventées.", "Paramètres relus.", "PDF non publié.", "Pas de dépôt CNSS.", "PRO."],
    questions: [
      q("Toutes les mentions légales sont-elles garanties ?", "Non. Le bulletin montre le calcul préparé. La liste légale se confirme avec votre conseil."),
      q("Puis-je payer le salaire depuis le bulletin ?", "Le bulletin prépare les montants. Le paiement et les déclarations sociales restent vos opérations."),
      q("ESSENTIEL a-t-il les bulletins ?", "Non. Ils sont dans PRO."),
      q("Où est la TVA ?", "Ailleurs : export SIMPL, dépôt par vous. Voir le tutoriel."),
    ],
    related: [tutorial, paie, { href: "/blog/paie-cnss-amo-ir-maroc", label: "CNSS, AMO, IR" }, { href: "/blog/etat-9421-traitements-salaires", label: "État 9421" }, pro],
  }),
  art({
    slug: "journaux-comptables-pme-maroc",
    title: "Journaux comptables pour une PME | Felexia",
    description: "Journaux comptables : ventes, achats, banque et caisse dans ESSENTIEL. PRO ajoute le grand livre et la balance. Ce n’est pas une comptabilité certifiée.",
    h1: "Journaux comptables d’une PME : ce que Felexia tient, et ce que le conseil valide",
    category: "tva-fiscalite",
    alt: "Fond bleu Felexia, sans photo, pour les journaux de vente, d’achat et de trésorerie d’une PME.",
    essentials: ["ESSENTIEL écrit dans les journaux de vente, d’achat, de banque et de caisse à partir des pièces.", "PRO ajoute plan comptable, grand livre, balance et une liasse de gestion non certifiée.", "La déclaration TVA et l’export SIMPL sont dans ESSENTIEL.", "Rien n’est déposé automatiquement."],
    introduction: ["Un journal sert à retrouver une pièce et un montant. Il ne remplace pas l’expert-comptable. Felexia le tient pour que l’échange avec lui parte de faits saisis, pas de fichiers épars."],
    sections: [
      { id: "essentiel", title: "Dans ESSENTIEL", paragraphs: ["Une facture, un avoir ou un règlement laisse une écriture dans le journal correspondant. Vous ouvrez la pièce depuis l’écriture.", "Ces journaux aident le suivi. Ils ne sont pas une attestation."] },
      { id: "pro", title: "Dans PRO", paragraphs: ["Le plan comptable, le grand livre et la balance s’ajoutent. Une liasse de gestion peut être préparée depuis les écritures : bilan, CPC, ESG. Elle n’est pas certifiée et n’est pas un dépôt.", "Le rapprochement bancaire et les prévisions sont aussi de ce périmètre, sur devis."] },
      { id: "tva", title: "Et la TVA", paragraphs: ["La déclaration se prépare à côté des journaux, dans les deux offres. Le XML se télécharge. SIMPL reçoit le fichier seulement si vous l’y mettez.", "Un journal juste ne dispense pas de contrôler la période."] },
      { id: "pas", title: "Ce qu’on ne dit pas", paragraphs: ["On ne dit pas que le plan est « le » plan du Maroc dans tous ses détails. On dit que PRO propose un plan et des états.", "On ne dit pas que la liasse est acceptée par l’administration."] },
      { id: "conseil", title: "Le conseil", paragraphs: ["Les comptes, les taux et la liasse se relisent avec l’expert-comptable. Felexia ne signe pas à sa place.", "S’il manque une pièce, l’écriture manque. On ne fabrique pas un solde."] },
      { id: "offre", title: "Par où commencer", paragraphs: ["ESSENTIEL suffit pour facturer, encaisser et voir les journaux. PRO vient si vous voulez le grand livre.", "Le prix public est celui d’ESSENTIEL. PRO n’a pas de prix en ligne."] },
    ],
    walkthrough: ["Société fictive, trois factures, deux règlements. Les journaux de vente et de banque montrent les mêmes montants. On prépare la TVA de test sans la déposer. Le grand livre n’est ouvert que si l’offre est PRO." + bridge],
    example: { title: "Trois factures fictives", note: "Montants non réels.", rows: [
      { label: "ESSENTIEL", value: "Journaux", annotation: "Vente, achat, banque, caisse." },
      { label: "PRO", value: "Grand livre, balance", annotation: "Liasse non certifiée." },
      { label: "TVA", value: "XML à déposer", annotation: "Par l’entreprise." },
    ]},
    checklist: ["Journaux relus avec les pièces.", "Liasse non présentée comme déposée.", "TVA exportée à part.", "Conseil sollicité.", "Offre non mélangée."],
    questions: [
      q("Les journaux sont-ils dans ESSENTIEL ?", "Oui, ceux des ventes, achats, banque et caisse, à partir des pièces. Le grand livre est dans PRO."),
      q("La liasse est-elle officielle ?", "Non. C’est un état préparé. Il n’est pas certifié et n’est pas transmis."),
      q("Felexia remplace-t-il l’expert-comptable ?", "Non. Il prépare des pièces et des états."),
      q("Où est l’export TVA ?", "Dans ESSENTIEL et PRO. Le tutoriel montre le geste. Le dépôt est sur SIMPL."),
    ],
    related: [tutorial, compta, { href: "/declaration-tva-maroc", label: "Déclaration TVA" }, essentiel, pro],
  }),
  art({
    slug: "export-comptable-fiduciaire-maroc",
    title: "Export pour la fiduciaire | Felexia",
    description: "Préparer l’export pour la fiduciaire : PDF, CSV, journaux et archive de l’entreprise. Felexia ne promet pas un import universel dans tous les logiciels.",
    h1: "Préparer l’export pour la fiduciaire sans inventer un format unique",
    category: "tva-fiscalite",
    alt: "Fond bleu Felexia, sans photo, pour les exports utiles à une fiduciaire, sans format universel.",
    essentials: ["Les factures sortent en PDF. Des listes sortent en CSV.", "Une archive ZIP de l’entreprise se prépare dans les paramètres.", "Un FEC préparatoire existe en comptabilité. Ce n’est pas un dépôt.", "Aucun logiciel de cabinet n’est garanti compatible sans essai."],
    introduction: ["La fiduciaire a besoin de pièces, pas d’une promesse. On liste ce que Felexia sait sortir, et on laisse le cabinet dire ce qu’il peut lire."],
    sections: [
      { id: "pdf", title: "Les PDF", paragraphs: ["Chaque facture se télécharge. C’est la pièce que le client a eue, avec les identifiants saisis.", "Rangez-les par période. Un dossier unique « tout » se relit mal."] },
      { id: "csv", title: "Les CSV", paragraphs: ["Des listes s’exportent pour Excel. Ce n’est pas toute la comptabilité.", "L’import inverse des clients existe, avec contrôle d’ICE. Ce n’est pas un import de toutes les écritures historiques."] },
      { id: "zip", title: "L’archive", paragraphs: ["L’administrateur trouve « Exporter les données » : une archive de son entreprise, pas celle du voisin.", "Elle aide à transmettre un lot. Elle ne se substitue pas à la lecture du cabinet."] },
      { id: "fec", title: "Le FEC préparatoire", paragraphs: ["Un fichier de type FEC se prépare en comptabilité. Le site le dit déjà : ce n’est pas une transmission officielle.", "Ne le présentez pas comme accepté tant que le cabinet ne l’a pas ouvert."] },
      { id: "tva", title: "La TVA à part", paragraphs: ["Le XML SIMPL-TVA est l’export de déclaration, pas l’export fiduciaire. Vous le déposez vous-même.", "Donnez au cabinet le fichier et la période, et dites que le dépôt est votre geste."] },
      { id: "limite", title: "Limite", paragraphs: ["Felexia ne garantit pas que chaque logiciel de cabinet importera ces fichiers sans reprise.", "Un essai sur un mois fictif avec le cabinet vaut mieux qu’une promesse."] },
    ],
    walkthrough: ["Mois fictif. PDF des factures, CSV des règlements, journaux, XML de TVA non déposé. Le cabinet fictif dit lequel de ces formats il ouvre. On ne devine pas pour lui." + bridge],
    example: { title: "Un lot pour le cabinet", note: "Fiction.", rows: [
      { label: "PDF", value: "Factures", annotation: "Pièces." },
      { label: "ZIP", value: "Archive entreprise", annotation: "Pas le voisin." },
      { label: "FEC", value: "Préparatoire", annotation: "À faire lire." },
    ]},
    checklist: ["Formats réellement listés.", "Pas de promesse d’import universel.", "TVA identifiée à part.", "Archive de la bonne entreprise.", "Cabinet consulté."],
    questions: [
      q("Felexia parle-t-il à tous les logiciels de cabinet ?", "Non. Il sort des PDF, des CSV, une archive et un FEC préparatoire. Le cabinet dit ce qu’il lit."),
      q("Le FEC est-il un dépôt ?", "Non. Il est préparatoire."),
      q("Puis-je exporter seulement mon entreprise ?", "Oui. L’archive concerne l’entreprise ouverte, pas les autres."),
      q("Où est le XML de TVA ?", "Dans la déclaration. Le tutoriel montre comment le préparer. Vous le déposez."),
    ],
    related: [tutorial, compta, { href: "/blog/journaux-comptables-pme-maroc", label: "Journaux" }, essentiel, pro],
  }),
  art({
    slug: "modes-paiement-facture-maroc",
    title: "Modes de paiement et codes SIMPL | Felexia",
    description: "Modes de paiement : espèces, chèque, prélèvement, virement, effet, compensation ou autre. Felexia écrit ces codes dans le XML. À confirmer sur SIMPL.",
    h1: "Modes de paiement et codes du relevé : ce que l’export Felexia écrit",
    category: "tva-fiscalite",
    alt: "Fond bleu Felexia, sans photo, pour les codes de paiement écrits dans l’export SIMPL-TVA.",
    essentials: ["Espèces 1, chèque 2, prélèvement 3, virement 4, effet 5, compensation 6.", "La carte et tout mode inconnu s’écrivent 7, comme « autre ».", "Ce sont les codes du fichier Felexia, à confirmer sur la notice SIMPL du jour.", "Le dépôt du fichier reste le vôtre."],
    introduction: ["Le relevé de déductions demande un mode de paiement. Felexia en écrit un à partir du règlement saisi. Il ne choisit pas à votre place le mode que le portail préfère si la notice a changé."],
    sections: [
      { id: "codes", title: "Les codes écrits", paragraphs: ["1 espèces, 2 chèque, 3 prélèvement, 4 virement, 5 effet de commerce, 6 compensation, 7 carte ou autre ou mode non reconnu.", "Un règlement sans mode connu ne bloque pas tout le fichier sur un code inventé au-delà de cette liste : il tombe dans 7."] },
      { id: "saisie", title: "Où ça se saisit", paragraphs: ["Sur le règlement du fournisseur, pas dans le XML. Corrigez le règlement, puis régénérez.", "Un paiement partiel garde son mode et sa date. La date manquante ne se fabrique pas."] },
      { id: "regime", title: "Lien avec le régime", paragraphs: ["Si vous êtes à l’encaissement, la date de ce paiement compte pour la déduction. Sur les débits, la logique de date change, comme l’autre guide l’explique.", "Le code de mode ne remplace pas le régime."] },
      { id: "notice", title: "La notice du portail", paragraphs: ["Si SIMPL attend un autre code le jour du dépôt, vous ne forcez pas. Vous lisez le message et vous demandez à votre conseil.", "Ce guide ne recopie pas la notice. Il décrit le logiciel."] },
      { id: "exemple", title: "Un règlement fictif", paragraphs: ["Une facture fournisseur fictive payée par virement reçoit 4. Payée par effet, 5. Payée par carte, 7.", "Les montants n’importent pas. Le mode, si."] },
      { id: "depot", title: "Puis le dépôt", paragraphs: ["Vous téléchargez le XML et vous le déposez. Felexia ne voit pas l’accusé.", "Le tutoriel montre les écrans Felexia, pas ceux de SIMPL."] },
    ],
    walkthrough: ["Trois règlements fictifs : virement, effet, carte. L’export de test porte 4, 5 et 7. On ne le dépose pas. On vérifie que personne n’a laissé le mode vide par habitude." + bridge],
    example: { title: "Trois modes", note: "Fiction.", rows: [
      { label: "Virement", value: "4", annotation: "Code Felexia." },
      { label: "Effet", value: "5", annotation: "Lettre de change, LCN." },
      { label: "Carte", value: "7", annotation: "Avec « autre »." },
    ]},
    checklist: ["Mode saisi sur le règlement.", "Code relu dans un export de test.", "Notice SIMPL non contredite en silence.", "Date présente si l’encaissement l’exige.", "Dépôt manuel."],
    questions: [
      q("La carte est-elle un code à part de 1 à 6 ?", "Dans Felexia, la carte s’écrit 7, comme les modes inconnus."),
      q("Puis-je modifier le code dans le XML ?", "Corrigez le règlement et régénérez. Ne bricolez pas le fichier."),
      q("Ces codes sont-ils garantis acceptés ?", "Ce sont ceux du logiciel. La notice du portail, le jour du dépôt, prime si elle diffère."),
      q("Qui dépose ?", "Vous, sur SIMPL. Le tutoriel prépare le fichier."),
    ],
    related: [tutorial, { href: "/blog/tva-encaissement-ou-debits-maroc", label: "Encaissement ou débits" }, { href: "/declaration-tva-maroc", label: "Déclaration TVA" }, essentiel],
  }),
  art({
    slug: "calendrier-fiscal-pme-maroc",
    title: "Calendrier fiscal d’une PME : que suivre",
    description: "Calendrier fiscal d’une PME au Maroc : quoi suivre (TVA, CNSS, impôts), sans date figée. Les échéances se lisent sur les portails, pas dans cet article.",
    h1: "Calendrier fiscal d’une PME : une liste de contrôles, pas un calendrier de dates",
    category: "tva-fiscalite",
    alt: "Fond bleu Felexia, sans photo, pour une liste de contrôles fiscaux sans dates inventées.",
    essentials: ["Cette page ne publie aucune date limite.", "Elle liste ce qu’une PME doit penser à vérifier : TVA, CNSS, impôts sur le résultat.", "Les échéances se lisent sur les communiqués et les portails.", "Felexia prépare des fichiers. Il ne les dépose pas et ne rappelle pas une date officielle."],
    introduction: ["Un calendrier faux est pire qu’une liste. Les dates bougent, les communiqués aussi. On dit donc quoi ouvrir, pas quel jour cocher pour toujours."],
    sections: [
      { id: "pas-dates", title: "Pourquoi il n’y a pas de dates", paragraphs: ["Une date recopiée vieillit. L’article sur la TVA des PME cite, lui, des textes avec sa date de lecture. Celui-ci ne les répète pas comme s’ils étaient éternels.", "Chaque année, vous rouvrez la source. Vous ne vous fiez pas à un tableau de blog."] },
      { id: "tva", title: "La TVA", paragraphs: ["À suivre : la période (mois ou trimestre), la déclaration, le relevé, le paiement s’il est dû. Felexia prépare la déclaration et le XML.", "Le dépôt et le paiement se font sur le portail, par vous. Le tutoriel montre la préparation."] },
      { id: "cnss", title: "La CNSS", paragraphs: ["À suivre : les salaires du mois, les numéros, le canal de déclaration. Felexia prépare des bulletins et un bordereau texte, dans PRO.", "Il ne dépose pas. Damancom n’est pas généré."] },
      { id: "resultat", title: "L’impôt sur le résultat", paragraphs: ["À suivre avec votre conseil : les échéances d’acompte ou de solde qui concernent votre régime. Ce guide ne les énumère pas.", "Les journaux et les états aident à préparer la conversation. Ils ne calculent pas l’impôt dû à votre place."] },
      { id: "outil", title: "Ce que le logiciel rappelle", paragraphs: ["Felexia peut montrer des échéances de factures, pas le calendrier légal complet.", "N’attendez pas une notification officielle depuis l’application."] },
      { id: "methode", title: "Une méthode", paragraphs: ["Une fois par mois, ouvrez les portails ou demandez au conseil ce qui tombe. Notez-le dans votre agenda, pas dans cet article.", "Gardez les fichiers préparés à côté de la note « déposé / pas déposé »."] },
    ],
    walkthrough: ["La PME fictive n’a pas de date dans son exemple. Elle a une liste : TVA à préparer, CNSS à préparer, question au conseil sur l’impôt. Elle coche ce qu’elle a déposé elle-même. Felexia n’a rien envoyé." + bridge],
    example: { title: "Une liste, pas un calendrier", note: "Aucune échéance chiffrée.", rows: [
      { label: "TVA", value: "À préparer puis déposer", annotation: "Date : portail." },
      { label: "CNSS", value: "À préparer puis déposer", annotation: "Pas Damancom auto." },
      { label: "Résultat", value: "Question au conseil", annotation: "Pas de date ici." },
    ]},
    checklist: ["Aucune date recopiée de mémoire.", "Portails ouverts.", "Fichiers préparés rangés.", "Dépôts faits par l’entreprise.", "Article TVA consulté pour les sources déjà datées."],
    questions: [
      q("Quelle est la date limite de TVA ?", "Elle n’est pas dans cet article. Elle se lit sur les sources officielles et dans le guide TVA déjà sourcé, avec sa date de lecture."),
      q("Felexia envoie-t-il un rappel légal ?", "Non. Il prépare des fichiers. Il ne notifie pas une échéance administrative."),
      q("La CNSS est-elle déposée ?", "Non, pas par Felexia."),
      q("Où préparer la TVA ?", "Dans la déclaration, puis le tutoriel d’export. Le dépôt est sur SIMPL."),
    ],
    related: [tutorial, { href: "/blog/tva-maroc-pme", label: "TVA au Maroc, sources datées" }, compta, paie, { href: "/blog/plf-2027-pme-maroc", label: "PLF 2027, encore un projet" }],
  }),
  art({
    slug: "credit-tva-remboursement-maroc",
    title: "Crédit de TVA : préparer sans promesses",
    description: "Crédit de TVA au Maroc : quand la TVA déductible préparée dépasse la TVA collectée. Felexia ne promet ni remboursement, ni délai, ni seuil ici.",
    h1: "Crédit de TVA et remboursement : ce que la déclaration préparée peut montrer",
    category: "tva-fiscalite",
    alt: "Fond bleu Felexia, sans photo, pour un crédit de TVA préparé sans promesse de remboursement.",
    essentials: ["Un crédit peut apparaître dans la déclaration préparée si la TVA déductible dépasse la TVA collectée.", "Felexia ne dit pas si vous avez droit au remboursement.", "Aucun délai, aucun seuil et aucun formulaire de remboursement n’est décrit.", "Le dépôt sur SIMPL reste le vôtre. Le projet de loi de finances n’est pas traité comme une loi votée définitive."],
    introduction: ["Voir un crédit à l’écran ne veut pas dire que l’argent reviendra. On explique seulement d’où le chiffre peut venir dans Felexia, et on s’arrête avant les conditions de remboursement."],
    sections: [
      { id: "chiffre", title: "D’où vient le chiffre", paragraphs: ["Des factures de vente et des déductions préparées sur la période, selon le régime. Si les déductions dépassent la TVA des ventes, le solde préparé est un crédit.", "Une pièce fausse fabrique un faux crédit. Le contrôle avant export sert à ça."] },
      { id: "pas", title: "Ce qui n’est pas dit", paragraphs: ["Pas de seuil. Pas de délai de remboursement. Pas de liste de pièces à joindre. Ces points se lisent auprès de la DGI et de votre conseil, le jour où vous les demandez.", "Le projet de loi de finances déjà présenté sur le site reste un projet dans cet article. On ne l’applique pas comme un texte définitif."] },
      { id: "report", title: "Crédit et période suivante", paragraphs: ["Que le crédit se reporte ou se demande est une décision fiscale, pas un bouton décrit ici.", "Ne « consommez » pas un crédit dans un tableur parallèle sans que la déclaration déposée dise la même chose."] },
      { id: "depot", title: "Le dépôt", paragraphs: ["Vous exportez le XML et vous le déposez. Felexia ne demande pas le remboursement à votre place.", "L’accusé du portail se range avec le fichier."] },
      { id: "factures", title: "Les factures électroniques", paragraphs: ["Le parcours PDF/XML n’est pas une demande de remboursement et n’est pas connecté à la DGI.", "Il archive une version. C’est tout, tant que la loi et la plateforme ne sont pas en vigueur."] },
      { id: "conseil", title: "Qui décide", paragraphs: ["Votre conseil dit si le crédit est demandable, reportable, ou simplement le signe d’une erreur de saisie.", "Un crédit trop beau se revérifie avant tout dépôt."] },
    ],
    walkthrough: ["Société fictive, beaucoup d’achats, peu de ventes, sur un mois inventé. La déclaration préparée montre un crédit. Personne ne le réclame dans l’exemple. On vérifie d’abord les factures fournisseurs et les paiements. Puis, seulement si le conseil le dit, on parlera de remboursement, hors de ce guide." + bridge],
    example: { title: "Un crédit fictif", note: "Pas un dossier de remboursement.", rows: [
      { label: "Ventes", value: "Peu de TVA", annotation: "Mois inventé." },
      { label: "Achats", value: "Plus de TVA", annotation: "À contrôler." },
      { label: "Suite", value: "Conseil", annotation: "Pas de délai annoncé." },
    ]},
    checklist: ["Pièces relues avant de croire au crédit.", "Aucun seuil inventé.", "PLF non traité comme loi définitive.", "Dépôt manuel.", "Conseil avant toute demande."],
    questions: [
      q("Felexia rembourse-t-il la TVA ?", "Non. Il peut montrer un crédit dans la déclaration préparée. Le droit au remboursement et les délais ne sont pas décidés ici."),
      q("Un crédit à l’écran est-il acquis ?", "Non. Il peut venir d’une erreur. On relit les pièces, puis on dépose soi-même si la déclaration est juste."),
      q("Où voir le projet de loi de finances ?", "Dans l’article déjà publié, qui le traite comme un projet, avec sa date. Pas comme une règle appliquée."),
      q("Qui dépose ?", "Vous, sur SIMPL. Le tutoriel prépare l’export."),
    ],
    related: [tutorial, { href: "/blog/tva-maroc-pme", label: "TVA au Maroc" }, { href: "/blog/plf-2027-pme-maroc", label: "PLF 2027" }, { href: "/declaration-tva-maroc", label: "Déclaration TVA" }, essentiel],
  }),
];
