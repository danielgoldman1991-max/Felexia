# Vérification des états de sortie

## Périmètre recensé

Quatorze routes d’aperçu imprimable :

- Ventes : devis, commandes clients, bons de livraison, bons de retour.
- Facturation : factures clients, avoirs, reçus de règlement client, relances.
- Achats : commandes fournisseurs, réceptions, factures fournisseurs, reçus de règlement fournisseur (nouvelle sortie).
- Comptabilité : journal filtré.
- RH : bulletin préparatoire, sans promesse de calcul de paie validé.

Les prévisions de trésorerie disposent aussi d’une présentation dédiée à l’impression sur leur page existante.

L’export de journal au format HTML compatible Excel bénéficie de sa propre présentation. Les exports CSV (plan comptable, TVA, documents et prévisions) et les téléchargements de fichiers fiscaux/documents conservent leur structure de données ; le style de l’aperçu ne modifie pas ces formats d’échange.

## Cas synthétiques et assertions SSR

`npx tsx scripts/verify-print-outputs.tsx` génère huit fichiers HTML et un manifeste dans `../backups/print-qa-20261031`, ou dans le dossier passé en premier argument. Il ne lit aucune base de données, session ou variable d’environnement.

Les cas couvrent : facture MAD de trois lignes ; facture EUR de 75 lignes ; achat EUR avec remise ; devis ; commande client ; bon de livraison ; bon de retour ; journal de 120 écritures. Les identités et adresses sont longues et fictives, les notes contiennent des sentinelles de contrôle et une référence sans espace de 162 caractères teste les retours à la ligne. La facture longue inclut un prix unitaire de 12 345 678,90 EUR et un total de 27 197 261,41 EUR.

Assertions réussies : chaque ligne apparaît une seule fois, la devise EUR ne devient pas MAD, les remises restent visibles, une ville ne masque pas l’adresse, les notes internes ne sont pas imprimées, les documents logistiques conservent leur contenu non monétaire.

## Pagination PDF et rendu visuel

Trois PDF ont été rendus à partir du HTML SSR et de la feuille `src/styles/print.css` avec la distribution autonome officielle WeasyPrint 70.0, puis inspectés avec pdfplumber et Poppler du runtime documentaire :

| Cas | Pages | Format | Lignes présentes | Hors marges de sécurité |
| --- | ---: | --- | ---: | ---: |
| Facture courte, identité longue, conditions, TVA et notes | 1 | A4 portrait | 3/3 | 0 |
| Facture longue EUR, remises, descriptions et grands montants | 7 | A4 portrait | 75/75 | 0 |
| Journal long | 7 | A4 paysage | 120/120 | 0 |

Les dimensions réelles mesurées sont 595,28 × 841,89 points en portrait et 841,89 × 595,28 points en paysage. Les compteurs `Page X / Y` sont présents sur toutes les pages. Les en-têtes de tableaux sont répétés sur chaque page contenant des lignes. Aucune ligne n’est perdue ni dupliquée. Les PNG des pages de début et de fin ont été inspectés : aucun chevauchement, texte tronqué ni total illisible observé. Le cas court a permis de corriger un pied de page isolé sur une seconde feuille.

Le résultat détaillé est conservé dans `pdf-layout-verification.json`. Le validateur réutilisable est `scripts/verify-print-pdf-layout.py` ; il attend un dossier contenant les trois PDF `facture-courte-mad.pdf`, `facture-longue-eur.pdf` et `journal-long-paysage.pdf`.

Exemple de reproduction après génération HTML, avec WeasyPrint installé :

```powershell
weasyprint ../backups/print-qa-20261031/facture-courte-mad.html ../backups/print-qa-20261031/facture-courte-mad.pdf
weasyprint ../backups/print-qa-20261031/facture-longue-eur.html ../backups/print-qa-20261031/facture-longue-eur.pdf
weasyprint ../backups/print-qa-20261031/journal-long-paysage.html ../backups/print-qa-20261031/journal-long-paysage.pdf
python scripts/verify-print-pdf-layout.py ../backups/print-qa-20261031
```

## Limites de la preuve

L'aperçu navigateur a aussi été vérifié sur les documents QA existants : facture, règlement fournisseur avec son affectation de 120 MAD et journal banque filtré. Sur petit écran, le journal s'ajuste sans débordement en mode ajusté ; le bouton Taille réelle permet de parcourir la feuille A4 sans modifier sa mise en page d'impression. Le retour au journal conserve les filtres de période.

WeasyPrint valide la fragmentation en pages et la géométrie PDF de ces cas synthétiques ; ce moteur ne remplace pas la vérification de l’aperçu et du dialogue d’impression dans le navigateur. Il ignore notamment `text-wrap: balance`, la media query de petit écran et `print-color-adjust`. La preuve PDF ne couvre pas une imprimante physique ni chaque combinaison possible de données. Les contrôles d’accès et les parcours métier relèvent des tests de lancement existants et des vérifications du parent.
