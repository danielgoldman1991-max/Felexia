# Baseline FelexiaERP V3

Date de référence : 11 août 2026  
Mode : audit local du code et audit distant strictement en lecture seule.

## Périmètre observé

- Application Next.js 16.3 / React 19 / TypeScript strict / Tailwind CSS 4.
- Données Supabase multi-tenant, Stripe, modules ventes, achats, stock, trésorerie, comptabilité, documents et RH.
- 114 routes applicatives produites au build initial.
- Environ 800 fichiers applicatifs et documentaires hors dépendances.
- Arbre de travail déjà modifié avant la mission : toutes les modifications préexistantes ont été conservées.

## Contrôles techniques initiaux

| Contrôle | Résultat initial | Preuve |
|---|---:|---|
| ESLint | PASS | `npm run lint` — 0 erreur |
| TypeScript | PASS | `tsc --noEmit` — 0 erreur |
| Build production | PASS | 114 routes compilées |
| Régressions ciblées existantes | PASS | script `test:regressions` |
| Vulnérabilités npm connues | PASS | `npm audit` — 0 vulnérabilité |
| Landing publique | PASS | réponse HTTP 200 et captures multi-formats |
| Dashboard authentifié mobile | FAIL | débordement horizontal à 375 px |

## Baseline données

Le premier audit global a été exécuté avec `scripts/audit-data-integrity.ts`, sans aucune écriture. L’ancien tenant `societe-demo` contenait 2 177 anomalies : 2 020 P0 et 157 P1. Les catégories dominantes étaient les totaux de documents, paiements/factures, statuts impossibles, stock, trésorerie et règlements non affectés.

La cause principale n’était pas une dérive arithmétique du moteur, mais le générateur historique de démonstration : les lignes étaient associées à un document avec `indexOf(line) % documents.length`, donc à un parent aléatoire. Le script ignorait aussi certaines erreurs d’insertion et produisait des soldes dérivés incohérents.

## Défauts confirmés avant correction

- Facture fournisseur marquée payée, mais écran détail affichant 0,00 MAD payé.
- Réception fournisseur historiquement susceptible d’afficher des totaux à zéro.
- Prévision 600 MAD exposée à une double conversion pourcentage/centimes.
- Stock initial non garanti par un mouvement dans tous les chemins.
- Solde de trésorerie lu depuis plusieurs mécanismes et mises à jour non atomiques.
- Recherche globale pouvant échouer silencieusement ou rester visuellement vide.
- Notifications et aide inaccessibles sur mobile.
- Dashboard authentifié plus large que le viewport mobile.
- Sources d’achats absentes de la colonne « document source » du registre de stock.
- « Top clients » vide à cause d’une colonne inexistante demandée à PostgREST.

## Captures baseline

Les captures se trouvent dans `training/v3/screenshots/` : landing desktop/tablette/mobile et dashboard desktop/tablette/mobile. La capture `baseline-dashboard-mobile.png` matérialise le débordement initial.

## Limites de la baseline

- Aucun accès SQL direct ni Supabase CLI n’est disponible dans l’environnement ; les migrations nouvelles ne sont donc pas déclarées appliquées.
- Aucun secret, token, email réel ou contenu personnel n’est inclus dans les rapports.
- L’ancien tenant de démonstration n’a pas été supprimé ou réécrit automatiquement.

