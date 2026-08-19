# Rapport de réparation des données

## Cause racine principale

Le générateur historique associait les lignes à leurs documents avec la position globale de l’objet dans un tableau. Une ligne de facture, commande ou réception pouvait donc être rattachée à n’importe quel en-tête. Les insertions par lot pouvaient aussi continuer après une erreur.

## Corrections du générateur

- parent explicite `__parent_reference`, résolu vers l’identifiant exact après insertion ;
- suppression du champ technique avant écriture ;
- arrêt immédiat à la première erreur de lot ;
- paiements complets/partiels accompagnés d’allocations exactes ;
- mouvements de trésorerie reliés aux paiements ;
- stock initial et réceptions inscrits dans le registre ;
- `current_stock`, niveaux et mouvements réconciliés ;
- soldes de comptes recalculés depuis l’ouverture et les mouvements.

## Cadre de réparation historique

La migration `20260811090000_data_integrity_repair_framework.sql` introduit :

- `data_repair_runs`, journal immuable des exécutions ;
- RPC `repair_erp_integrity(organization, dry_run, scopes)` ;
- portée obligatoire à une organisation ;
- dry-run par défaut ;
- transaction unique avec annulation complète sur erreur ;
- accès `service_role` uniquement ;
- scopes `payments`, `treasury`, `accounting` et, explicitement, `document_headers`.

Le script `scripts/repair-data-integrity.ts` refuse toute application sans `--apply --confirm=APPLY_REPAIRS`. Une réparation des en-têtes de documents ne peut pas être mélangée silencieusement à d’autres scopes.

## État d’exécution

| Cible | Dry-run | Apply | État |
|---|---:|---:|---|
| Tenant V3 synthétique | audit équivalent : 0 anomalie | inutile | PASS |
| Ancien `societe-demo` | audit read-only effectué | non exécuté | EN ATTENTE |
| Tenants non démo | non ciblés individuellement | jamais exécuté | PROTÉGÉS |

Aucune réécriture historique globale et aucune suppression de données réelles n’ont été effectuées.

