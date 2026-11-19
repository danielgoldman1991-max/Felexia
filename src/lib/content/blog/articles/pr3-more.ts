import type { ArticleSpec } from "@/lib/content/blog/article-shell";
import { offer } from "@/lib/content/blog/article-shell";

const tutorial = { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel déclaration TVA et export SIMPL-TVA" };
const landing = { href: "/declaration-tva-maroc", label: "Déclaration de TVA" };
const essentiel = { href: "/essentiel", label: "ESSENTIEL" };
const disclaimer = "Contenu informatif. Aucun taux, délai ou numéro de texte n’est fixé ici. Vérifiez le portail ou votre conseil avant de déposer. Les exemples sont fictifs.";

export function pack(partial: Omit<ArticleSpec, "disclaimer">): ArticleSpec {
  return { ...partial, disclaimer };
}

export const MORE_SPECS: ArticleSpec[] = [
  pack({
    slug: "deposer-declaration-tva-simpl",
    title: "Déposer le relevé de TVA sur SIMPL | Felexia",
    description: "Déposer le relevé de déductions TVA sur SIMPL : Felexia prépare le XML, vous l’importez et vous validez vous-même. Aucun dépôt n’est envoyé.",
    h1: "Déposer le relevé de déductions TVA sur SIMPL après l’export Felexia",
    category: "tva-fiscalite",
    alt: "Fond bleu Felexia, sans photo, pour le dépôt du relevé de déductions TVA sur SIMPL.",
    essentials: [
      "Felexia prépare le XML du relevé de déductions et peut le mettre dans un ZIP.",
      "L’import sur SIMPL, le contrôle du portail et la validation sont faits par l’entreprise.",
      "Ce guide ne recopie pas les écrans du portail : ils changent.",
      "Le tutoriel illustré reste derrière le formulaire e-mail pour son PDF.",
    ],
    introduction: [
      "Le geste se coupe en deux. D’un côté, le fichier préparé dans Felexia. De l’autre, le dépôt sur SIMPL, que vous faites vous-même. ",
      "Le pas à pas des écrans Felexia est dans le ",
      tutorial,
      ".",
    ],
    sections: [
      { id: "fichier", title: "Ce que vous téléchargez", paragraphs: [
        "Depuis la déclaration, vous obtenez le XML du relevé de déductions. Le nom interne du fichier préparé est celui du modèle : un relevé, pas une liasse et pas une facture électronique. Vous le gardez avec la période, par exemple « mars » d’une société fictive, sans le mélanger au fichier du mois d’après.",
        "Ne modifiez pas le XML dans un éditeur pour « corriger vite ». Si un montant ou un identifiant est faux, corrigez la facture ou le fournisseur dans Felexia, relancez le contrôle, puis téléchargez à nouveau. Un fichier bricolé ne se régénère plus.",
      ]},
      { id: "portail", title: "Ce que le portail fait, et que Felexia ne fait pas", paragraphs: [
        "SIMPL est le téléservice de la DGI. Vous vous y connectez avec vos propres accès. Felexia n’a pas votre mot de passe, n’ouvre pas la session et ne voit pas si le fichier est accepté. Le guide ne décrit donc pas une suite de clics : la page officielle fait foi le jour du dépôt.",
        "En pratique, les portails de ce type demandent d’importer un fichier, de lire les erreurs, puis de valider. Tant que vous n’avez pas validé, rien n’est déposé. Une simulation ou un téléchargement dans Felexia n’est pas cette validation.",
      ]},
      { id: "controles", title: "Les contrôles à faire avant d’importer", paragraphs: [
        "Vérifiez l’identifiant fiscal de l’entreprise, l’année et la période, le régime, et les fournisseurs du relevé. Pour déduire, l’IF du fournisseur est demandé à côté de l’ICE. Un ICE qui n’a pas 15 chiffres est refusé à la saisie. Un IF non numérique l’est aussi dans l’export.",
        "Vérifiez aussi les paiements. Si le régime suit l’encaissement, une déduction sans date de paiement claire ne doit pas être forcée. Le détail est dans l’article sur l’encaissement et les débits. Le mode de paiement écrit dans le XML suit les codes du logiciel, décrits à part.",
      ]},
      { id: "apres", title: "Après le dépôt", paragraphs: [
        "Gardez l’accusé que le portail vous donne, à côté du XML. Felexia ne le reçoit pas. Si le portail refuse une ligne, corrigez la pièce et produisez un nouveau fichier. N’envoyez pas deux versions sans savoir laquelle vous avez validée.",
        "Une déclaration déjà validée ne se défait pas en supprimant le fichier sur votre ordinateur. S’il faut rectifier, votre conseil dit comment. Le logiciel peut préparer un autre état. Il ne parle pas à l’administration.",
      ]},
      { id: "offre", title: "Qui a le droit de préparer le fichier", paragraphs: [
        `La déclaration et l’export sont dans ESSENTIEL, ${offer.essentielPrice}, et dans PRO. L’essai de ${offer.trial} ne dépose rien non plus. L’administrateur de l’entreprise prépare le fichier. Le lecteur peut le consulter selon ses droits, pas le valider sur SIMPL.`,
        "Le PDF du tutoriel se demande par le formulaire des guides. Il n’est pas une URL publique. Il montre une société de test, pas votre dossier.",
      ]},
      { id: "limites", title: "Ce que ce guide ne promet pas", paragraphs: [
        "Il ne promet pas que SIMPL acceptera le fichier, ni un délai de réponse, ni une dispense de paiement. Il ne décrit pas le mode EFI dans le détail des boutons. Vous lisez l’aide du portail.",
        "Il ne dit pas non plus que la facture électronique est transmise en même temps. Le parcours PDF/XML de Felexia est complet et attend la loi. Il ne dépose pas la TVA.",
      ]},
    ],
    notes: [
      "Le portail peut refuser un fichier pour une raison que Felexia n’affiche pas, parce que la règle du jour est la sienne. Notez le message exact, sans le paraphraser de mémoire, et corrigez la cause dans les pièces. Recommencez l’export. N’empilez pas les versions validées.",
      "L’identifiant fiscal de l’entreprise, l’année et la période doivent être ceux de la déclaration que vous allez signer. Un fichier de l’année précédente, ouvert par habitude, est une erreur fréquente. Le nom que vous donnez au téléchargement doit contenir l’année et la période.",
      "Si un collègue dépose à votre place, il lui faut les accès SIMPL, pas seulement le fichier. Felexia ne lui transmet pas ces accès. Le mandat, s’il y en a un, se règle entre vous et votre conseil, hors du logiciel.",
      "Prévoyez le temps de lire les messages du portail, pas seulement le temps de cliquer sur télécharger. Un relevé de quelques fournisseurs se contrôle vite. Un relevé long demande de retrouver la pièce citée par le message d’erreur. Notez le numéro de facture refusé, ouvrez-le dans Felexia, corrigez l’IF, l’ICE ou le montant, puis régénérez. Ne validez pas « quand même » un fichier dont une ligne vous est inconnue. Le paiement de la TVA due, s’il y en a un, se fait selon les instructions du portail, pas depuis Felexia.",
    ],
    practice: [
      "Choisissez la période et le régime avant de produire le fichier. Une période civile incomplète, ou un régime qui n’est pas le vôtre, se voit trop tard sur le portail.",
      "Contrôlez les anomalies dans Felexia. Corrigez les pièces. Ne corrigez pas le XML.",
      "Téléchargez le fichier et notez son nom avec l’année et la période. Ouvrez SIMPL vous-même.",
      "Importez, lisez les messages du portail, et ne validez que lorsque vous reconnaissez les montants.",
      "Archivez l’accusé avec le XML. Felexia n’en garde pas une copie venue de la DGI.",
    ],
    example: {
      title: "Société fictive, relevé de mars",
      note: "Aucune de ces pièces n’a été déposée. L’exemple montre seulement l’ordre.",
      rows: [
        { label: "Période", value: "Mars, société fictive", annotation: "Le mois se choisit dans Felexia." },
        { label: "Fichier", value: "XML téléchargé", annotation: "Pas encore importé sur SIMPL." },
        { label: "Dépôt", value: "Fait par l’entreprise", annotation: "Felexia ne valide pas à sa place." },
      ],
    },
    checklist: [
      "Le régime et la période sont ceux de la déclaration à faire.",
      "Les IF et ICE des fournisseurs du relevé sont relus.",
      "Le XML n’a pas été édité à la main.",
      "Vous avez un accès SIMPL, distinct de Felexia.",
      "Vous n’avez pas pris le téléchargement pour un dépôt.",
    ],
    questions: [
      { question: "Felexia envoie-t-il le relevé à la DGI ?", answer: "Non. Il prépare le XML. Vous l’importez et vous le validez sur SIMPL." },
      { question: "Puis-je corriger le XML dans un éditeur ?", answer: "Mieux vaut corriger la pièce dans Felexia et régénérer le fichier. Un XML modifié à la main n’est plus celui du logiciel." },
      { question: "Le PDF du tutoriel est-il public ?", answer: "Non. Il se demande par le formulaire e-mail des guides. Les pages du site, elles, se lisent sans ce formulaire." },
      { question: "L’export est-il réservé à PRO ?", answer: "Non. Il est dans ESSENTIEL et dans PRO. Le dépôt reste hors des deux offres." },
    ],
    related: [tutorial, landing, { href: "/blog/tva-encaissement-ou-debits-maroc", label: "Encaissement ou débits" }, { href: "/blog/modes-paiement-facture-maroc", label: "Codes de paiement du relevé" }, essentiel],
  }),
];
