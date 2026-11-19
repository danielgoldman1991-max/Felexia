import type { ArticleSpec } from "@/lib/content/blog/article-shell";
import { pack } from "@/lib/content/blog/articles/pr3-more";

const tutorial = { href: "/blog/declaration-tva-export-simpl", label: "Tutoriel SIMPL-TVA" };
const essentiel = { href: "/essentiel", label: "ESSENTIEL" };
const pro = { href: "/pro", label: "PRO" };
const devis = { href: "/logiciel-devis-facture-maroc", label: "Devis et factures" };

function q(question: string, answer: string) { return { question, answer }; }

export const SUITE_SPECS: ArticleSpec[] = [
  pack({
    slug: "facture-proforma-vs-facture-maroc",
    title: "Pro forma ou facture au Maroc | Felexia",
    description: "Pro forma ou facture au Maroc : la proposition n’est pas la facture numérotée. Le devis est dans PRO et la facture de vente est dans ESSENTIEL.",
    h1: "Facture pro forma et facture définitive : ne pas les confondre",
    category: "facturation",
    alt: "Fond bleu Felexia, sans photo, pour séparer une pro forma d’une facture de vente numérotée.",
    essentials: [
      "Une pro forma n’est pas, dans Felexia, la facture de vente qui prend un numéro de la série.",
      "Le devis PRO peut porter la proposition commerciale. La facture ESSENTIEL constate le montant.",
      "On ne transforme pas une pro forma en facture en changeant le titre du PDF.",
      "La déclaration de TVA se prépare à partir des factures, pas des brouillons commerciaux.",
    ],
    introduction: ["On envoie parfois un document « pour accord » avant de facturer. Ce document aide à se mettre d’accord. Il ne remplace pas la facture qui entre dans la numérotation et, plus tard, dans la déclaration que vous déposez vous-même."],
    sections: [
      { id: "roles", title: "Deux rôles", paragraphs: [
        "La pro forma, ou le devis, annonce un prix. Le client peut encore refuser. La facture dit qu’une vente est constatée dans votre série, avec un numéro que vous ne réutiliserez pas.",
        "Changer le mot du titre sur un PDF ne change pas la nature de la pièce dans le logiciel. Une facture validée reste une facture. Un devis reste un devis.",
      ]},
      { id: "ou", title: "Où c’est dans Felexia", paragraphs: [
        "Le devis, la commande et la livraison sont dans PRO. La facture, l’avoir et le règlement sont dans ESSENTIEL. Dire le contraire serait annoncer une fonction qui n’est pas dans l’offre de départ.",
        "Vous pouvez facturer sans devis, avec des lignes libres. Vous ne pouvez pas, dans ESSENTIEL, enchaîner un devis officiel du logiciel. Pour cela, il faut PRO, sur devis, sans prix affiché.",
      ]},
      { id: "tva", title: "La TVA suit la facture", paragraphs: [
        "Le relevé et la déclaration se nourrissent des factures et des avoirs, pas d’un document commercial non validé comme facture. Une pro forma oubliée dans un tiroir ne crée pas de TVA à déclarer à elle seule.",
        "Dès que vous validez une facture, elle peut entrer dans la période selon le régime. Vous préparez le XML ensuite. SIMPL ne reçoit rien tant que vous ne déposez pas.",
      ]},
      { id: "numero", title: "Le numéro", paragraphs: [
        "La facture prend le prochain numéro de la série. La pro forma ne doit pas consommer ce numéro si elle n’est pas une facture. Sinon vous expliquez un trou, ou deux contenus pour un seul numéro.",
        "Le guide de numérotation détaille la série continue. Ici, retenez de ne pas « recycler » un essai de pro forma en facture sous le même identifiant.",
      ]},
      { id: "client", title: "Ce que voit le client", paragraphs: [
        "Le client peut recevoir d’abord la proposition, puis la facture PDF avec votre ICE si vous l’avez saisi. Les deux envois ne se contredisent pas : les montants de la facture sont ceux que vous assumez.",
        "S’il y a un écart, vous ne réécrivez pas la facture émise. Vous faites un avoir ou une nouvelle pièce, selon ce que votre conseil indique.",
      ]},
      { id: "limite", title: "Ce qui n’est pas dit", paragraphs: [
        "Ce guide ne dit pas qu’une pro forma est juridiquement nulle dans tous les cas. Il dit qu’elle n’est pas la facture de vente numérotée de Felexia. Le reste se voit avec votre conseil.",
        "Il ne dit pas non plus qu’une facture électronique est transmise à la DGI parce que vous avez facturé. Le parcours PDF/XML attend la loi.",
      ]},
    ],
    walkthrough: [
      "L’atelier fictif « Bois Clair » envoie un devis PRO de 8 000 dirhams hors taxe pour un meuble. Le client demande une semaine. Rien n’est facturé. Rien n’entre dans la déclaration.",
      "Le client accepte. Bois Clair crée la facture ESSENTIEL, numéro suivant de la série, mêmes montants, ICE renseigné. Le PDF part au client. Le devis reste la proposition, la facture est la pièce.",
      "Personne ne renomme le devis en facture. Personne ne réutilise un numéro d’essai. Le règlement se rattache à la facture, pas au devis.",
      "En fin de mois, l’export de TVA de test ne contient que la facture. Le devis n’y est pas. Le fichier n’est pas déposé dans cet exemple.",
    ],
    notes: ["Ne mettez pas de vraie identité de client dans un devis de démonstration.", "Le prix du devis et celui de la facture se relisent avant validation.", "PRO ne s’achète pas en ligne : le bouton ouvre un brouillon d’e-mail."],
    practice: ["Envoyer la proposition sans numéro de facture.", "Facturer seulement après l’accord, dans la série.", "Rattacher le paiement à la facture.", "Exclure le devis de la déclaration.", "Déposer la TVA plus tard, vous-même."],
    example: { title: "Bois Clair, un meuble", note: "Montants fictifs.", rows: [
      { label: "Devis", value: "8 000 HT", annotation: "PRO. Pas une facture." },
      { label: "Facture", value: "Numéro de la série", annotation: "ESSENTIEL, après accord." },
      { label: "Déclaration", value: "La facture seule", annotation: "Le devis n’y entre pas." },
    ]},
    checklist: ["Devis et facture non confondus.", "Numéro non réutilisé.", "ICE relu sur le PDF.", "Déclaration sans le brouillon.", "Conseil si le régime de TVA de l’acompte se mêle à ce cas."],
    questions: [
      q("Puis-je faire une pro forma dans ESSENTIEL ?", "ESSENTIEL établit la facture. Le devis qui tient lieu de proposition commerciale est dans PRO. Une facture reste une facture dès qu’elle est émise."),
      q("La pro forma déclenche-t-elle la TVA ?", "Pas dans Felexia, tant qu’elle n’est pas une facture validée. Dès la facture, elle peut entrer dans la déclaration selon le régime."),
      q("Puis-je changer le titre du PDF ?", "Le titre ne change pas la pièce dans le logiciel. Ne présentez pas un devis comme une facture de la série."),
      q("Où est le tutoriel de dépôt ?", "Le tutoriel SIMPL-TVA montre l’export. Le dépôt reste sur le portail, par vos soins."),
    ],
    related: [tutorial, devis, { href: "/blog/numerotation-facture-maroc", label: "Numérotation" }, essentiel, pro],
  }),
];
