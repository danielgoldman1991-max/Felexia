# Progression FelexiaERP V3

Dernière mise à jour : 11 août 2026.

## Stress test transactionnel — tenant de campagne isolé (terminé)

- tenant `stress-flx-2026-001` (données fictives `STRESS-*`), seed + reset reproductible ;
- 6 scénarios déterministes (achats, ventes, métamorphique, concurrence, permissions, charge) : **63 PASS / 1 PARTIAL (finding)** ;
- invariants vérifiés par oracle : trésorerie (opening + Σ mouvements), stock (Σ mouvements = niveaux), totaux (round2), dette, arrondis ;
- idempotence paiements/stock, refus surpaiement, refus stock négatif, concurrence 2×8→1 livraison ;
- charge : 850+ documents, 0 échec d'écriture hormis le finding de numérotation ;
- **audit d'intégrité final : 0 anomalie** sur le tenant de campagne (les 3 tenants réels inchangés, 1567 anomalies classifiées connues) ;
- 4 findings documentés sans correctif applicatif : numérotation `SELECT max+1` non verrouillée (sales_documents/purchase_documents), rôle `stock_user` hors liste `stock.%`, RLS documents sans granularité de rôle, message de refus trésorerie trompeur ;
- livrables : `training/transaction-stress-test/RAPPORT.md`, `database-checks/resume_resultats.csv`, preuves `NN_scenario_*_UTC.txt`.

## Phase 1 — Baseline et intégrité

### Terminé

- inventaire technique et baseline multi-écrans ;
- lint, TypeScript, build, audit dépendances et régressions initiaux ;
- audit read-only d’intégrité sur 20 tables ;
- tenant synthétique Business reproductible ;
- correction du rattachement des lignes du seed ;
- cohérence financière du tenant V3 : 0 P0 / 0 P1 / 0 P2 ;
- composant monétaire canonique et tests exacts ;
- captures landing et dashboard initiales.

### Problèmes détectés et corrigés

- paiement fournisseur invisible dans le résumé de facture ;
- dashboard mobile hors viewport ;
- document d’achat absent de la traçabilité stock ;
- top clients vide ;
- agrégation de stock faible limitée à un seul dépôt ;
- réceptions, montants, recherche et actions mobiles vérifiés en session réelle.

### Tests réussis

- ESLint : 0 erreur ;
- TypeScript : 0 erreur ;
- régressions financières ciblées : PASS ;
- navigateur : facture fournisseur soldée, réception non nulle, prévision 600, recherche, stock initial, trésorerie, mobile.

### Blocages externes

- absence de Supabase CLI, `psql` et connexion SQL directe : migrations non appliquées et non exécutées localement ;
- la réinitialisation du mot de passe de l’ancien compte démo n’a pas été autorisée et n’a pas été contournée.

## Phase 2 — P0/P1 en cours

### Priorité immédiate

1. rendre la création/affectation/annulation des paiements fournisseur transactionnelle et idempotente ;
2. finaliser les invariants DB trésorerie/paiements et leur stratégie de déploiement ;
3. rendre les chaînes de démonstration commande → réception → facture cohérentes ;
4. étendre les tests E2E vente, achat, retour, stock, trésorerie et multi-tenant ;
5. poursuivre le design system, l’accessibilité, la sécurité et les livrables de release.

