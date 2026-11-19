import type { ArticleSpec } from "@/lib/content/blog/article-shell";
import { pack } from "@/lib/content/blog/articles/pr3-more";

const tutorial = { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel SIMPL-TVA" };
const essentiel = { href: "/essentiel", label: "ESSENTIEL" };
const pro = { href: "/pro", label: "PRO" };
const stock = { href: "/logiciel-gestion-stock-maroc", label: "Stock" };
const devis = { href: "/logiciel-devis-facture-maroc", label: "Devis et factures" };

const q = (question: string, answer: string) => ({ question, answer });

function base(partial: Omit<ArticleSpec, "disclaimer" | "notes" | "practice"> & { notes?: string[]; practice?: string[] }): ArticleSpec {
  return pack({
    notes: partial.notes ?? [
      "Les exemples restent fictifs. Ne collez pas un vrai ICE, un vrai numéro CNSS ou un vrai salaire dans une capture.",
      "Felexia prépare. Le dépôt TVA sur SIMPL, le dépôt CNSS et la connexion de facture électronique à la DGI ne sont pas faits par le logiciel.",
      "Si un doute porte sur un taux, un délai ou un formulaire, ouvrez le portail ou demandez à votre conseil avant d’envoyer.",
    ],
    practice: partial.practice ?? [
      "Partir de pièces saisies, pas d’un fichier parallèle.",
      "Relire les identifiants et les montants.",
      "Produire le PDF ou l’export.",
      "Ne pas confondre téléchargement et dépôt.",
      "Ranger la période et le nom du fichier.",
    ],
    ...partial,
  });
}

export const LAST_SPECS: ArticleSpec[] = [
  base({
    slug: "devis-bon-commande-livraison-facture-maroc",
    title: "Devis, commande, livraison, facture | Felexia",
    description: "Devis, bon de commande, livraison et facture au Maroc : qui est dans ESSENTIEL, qui est dans PRO. La facture seule ne crée pas tout le cycle.",
    h1: "Devis, bon de commande, livraison et facture : le fil, et ce que Felexia couvre",
    category: "facturation",
    alt: "Fond bleu Felexia, sans photo, pour le fil devis, commande, livraison et facture au Maroc.",
    essentials: ["La facture, l’avoir et le règlement sont dans ESSENTIEL.", "Le devis, la commande, la livraison et le retour sont dans PRO.", "La réception fournisseur suit la marchandise. Elle ne remplace pas la facture fournisseur.", "Aucun de ces documents n’est envoyé seul à la DGI."],
    introduction: ["Le fil commercial a plusieurs maillons. Les confondre fait croire qu’une facture a déjà livré, ou qu’un devis a déjà été déclaré. Felexia sépare les offres pour cette raison."],
    sections: [
      { id: "fil", title: "Le fil", paragraphs: ["Le devis propose. La commande retient. La livraison dit ce qui part. La facture constate le montant. Le règlement dit ce qui est payé. Chaque document a son rôle.", "Sauter une étape est possible : beaucoup de PME facturent sans devis. Ce n’est pas une erreur du logiciel. C’est un choix. L’inverse, un devis sans facture, n’entre pas dans la déclaration de TVA."] },
      { id: "offres", title: "ESSENTIEL et PRO", paragraphs: ["ESSENTIEL facture et encaisse. PRO ajoute le devis, la commande client, la livraison, le retour, la commande fournisseur et la réception. Le dire clairement évite une offre trompeuse.", "L’essai ouvre ESSENTIEL. Il n’ouvre pas le stock ni les devis. PRO se demande sur la page de l’offre, par un brouillon d’e-mail que vous envoyez."] },
      { id: "stock", title: "Le lien avec le stock", paragraphs: ["Une livraison peut sortir des quantités d’un emplacement. Une réception peut en entrer. Ces mouvements sont dans PRO, avec le stock. ESSENTIEL ne suit pas les emplacements.", "Un transfert entre deux emplacements ne sort pas la marchandise de l’entreprise. Le guide de stock le montre avec un exemple fictif."] },
      { id: "tva", title: "La TVA", paragraphs: ["Seules les factures et les avoirs nourrissent la déclaration préparée. Le bon de livraison n’est pas une facture. Vous préparez le XML ensuite et vous le déposez sur SIMPL.", "Le régime d’encaissement ou de débits décide de la date, pas le bon de commande."] },
      { id: "client", title: "Ce qu’on envoie au client", paragraphs: ["Le client peut recevoir le devis, puis la facture PDF. Le bon de livraison peut accompagner la marchandise. Ce sont des envois distincts, depuis vos outils, pas un envoi unique « officiel ».", "Le logo, l’ICE et les montants se relisent sur la facture, pas seulement sur le devis."] },
      { id: "limite", title: "Limite", paragraphs: ["Ce guide ne crée pas d’obligation d’avoir les quatre documents. Il dit où ils sont dans le produit.", "Il ne décrit pas un dépôt douanier ni un bon de livraison réglementé dans le détail. Votre conseil tranche si votre métier en exige un modèle précis."] },
    ],
    walkthrough: ["La société fictive « Atlas Négoce » envoie un devis de 20 cartons. Le client commande 15. PRO convertit. La livraison sort 15 cartons de la réserve. La facture ESSENTIEL porte 15, pas 20.", "Le règlement se rattache à la facture. Le devis et le bon ne sont pas des paiements.", "L’export de TVA de test ne voit que la facture. Personne ne dépose dans cet exemple.", "Si le client renvoie 2 cartons, un retour PRO et, s’il faut annuler du chiffre, un avoir. On ne réécrit pas la facture. Le magasinier fictif note l’emplacement. La facture ne change que par l’avoir, pour que le stock et le chiffre ne racontent pas deux histoires. Personne n’envoie le bon de livraison à la place du XML de TVA. Le tutoriel d’export reste le mode d’emploi de la préparation, et SIMPL reste le lieu du dépôt."],
    example: { title: "Atlas Négoce, 15 cartons", note: "Quantités fictives.", rows: [
      { label: "Devis", value: "20 cartons", annotation: "PRO." },
      { label: "Livré et facturé", value: "15", annotation: "La facture suit le livré, pas le devis entier." },
      { label: "Retour", value: "2", annotation: "Avoir si le montant change." },
    ]},
    checklist: ["Offre annoncée sans mélanger devis et facture.", "Quantité facturée relue.", "Stock seulement si PRO.", "Déclaration sans les bons.", "Avoir plutôt que réécriture."],
    questions: [
      q("Puis-je facturer sans bon de commande ?", "Oui. ESSENTIEL facture directement. La commande est un maillon PRO, pas une obligation du logiciel."),
      q("Le bon de livraison déclare-t-il la TVA ?", "Non. La déclaration préparée part des factures et des avoirs."),
      q("Le stock est-il dans l’essai ?", "Non. L’essai est ESSENTIEL. Les emplacements et les livraisons de stock sont dans PRO."),
      q("Où déposer la TVA ?", "Vous-même, sur SIMPL, après l’export. Le tutoriel montre la préparation."),
    ],
    related: [tutorial, devis, stock, { href: "/blog/gestion-de-stock-au-maroc", label: "Guide stock" }, essentiel, pro],
  }),
];
