# Rapport d’intégrité des données

## Méthode

`scripts/audit-data-integrity.ts` utilise exclusivement la clé serveur dans un processus local et n’exécute que des lectures. Les résultats masquent les identifiants par SHA-256 et n’incluent aucune donnée personnelle.

Contrôles couverts :

- paiements, allocations, factures, avoirs et statuts ;
- totaux d’en-tête versus lignes ;
- équilibre et totaux des écritures comptables ;
- stock courant versus mouvements et emplacements ;
- présence des sources de stock ;
- trésorerie : solde initial + entrées − sorties ;
- références dupliquées ;
- relations et `organization_id` multi-tenant.

## Résultat initial global

| Mesure | Valeur |
|---|---:|
| P0 | 2 020 |
| P1 | 157 |
| Total | 2 177 |
| Tables auditées | 20 |

La majorité se concentrait dans l’ancien tenant de démonstration et provenait de son générateur historique.

## Tenant de validation V3

Tenant synthétique : `societe-demo-v3-20260811`.

| Domaine | Volume audité |
|---|---:|
| Factures clients / lignes | 9 / 19 |
| Paiements clients / allocations | 15 / 5 |
| Factures fournisseurs / lignes | 7 / 13 |
| Paiements fournisseurs / allocations | 12 / 4 |
| Écritures / lignes comptables | 50 / 201 |
| Produits / mouvements / niveaux | 15 / 70 / 24 |
| Comptes / mouvements de trésorerie | 4 / 49 |
| Documents / lignes de vente | 27 / 70 |
| Documents / lignes d’achat | 14 / 42 |

Résultat après régénération du 11 août 2026 à 08:37:33 UTC : **0 P0, 0 P1, 0 P2, 0 table indisponible**.

## Preuves fonctionnelles complémentaires

- facture fournisseur de 70 095,60 MAD : paiement confirmé 70 095,60, reste 0,00, allocation et mouvement accessibles ;
- prévision saisie `600,00` : restitution 600,00 MAD et montant pondéré 600,00 MAD ;
- stock produit 58 U : cumul mouvements 58, mouvement initial +8 U visible, réceptions sources cliquables ;
- recherche `FF-DEMO-00005` : facture, fournisseur et montant visibles ;
- somme des quatre comptes de trésorerie identique au cockpit, audit invariant sans écart.

## Limites et risques ouverts

- Les deux migrations V3 doivent être exécutées sur un environnement de test Supabase avant la production.
- L’ancien tenant `societe-demo` n’a pas été modifié : son diagnostic reste une preuve historique, pas un état déclaré réparé.
- Les contrôles de machines à états et de cohérence des chaînes documentaires du générateur sont encore en cours d’extension.
