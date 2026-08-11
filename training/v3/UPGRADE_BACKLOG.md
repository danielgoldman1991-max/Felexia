# Backlog d’exécution V3

Statuts : `DONE`, `IN PROGRESS`, `PENDING`, `BLOCKED EXTERNAL`.

| ID | Domaine | Problème / scénario | Impact | Priorité | Cause racine | Solution et critères d’acceptation | Tests | Statut | Fichiers |
|---|---|---|---|---|---|---|---|---|---|
| P0-PAY-01 | Achats | Facture soldée affichée avec 0 payé | Dette et statut faux | P0 | Jointure PostgREST imbriquée silencieusement vide ; statut de rapprochement confondu avec confirmation | Charger allocations puis paiements par requêtes tenantées ; total payé = total, reste = 0, source navigable | Audit + navigateur facture payée | DONE | `src/lib/purchases.ts` |
| P0-ACC-01 | Comptabilité | 1 056 MAD devenait 1 036 MAD | Écriture fausse | P0 | Remise déduite deux fois du sous-total net | Base comptable issue du total net canonique | Régression exacte 1 056 / produit 880 | DONE | `src/lib/accounting-actions.ts`, `scripts/verify-qa-regressions.ts` |
| P0-PUR-01 | Achats | Réception affichée à zéro | Stock et valorisation faux | P0 | Totaux d’en-tête/lignes et association de seed incorrects | Calculer depuis les lignes, conserver quantités/coûts | Navigateur : 33 654 HT / 40 384,80 TTC | DONE | `src/lib/purchases.ts`, seed |
| P0-MON-01 | Trésorerie | 600 devient 60 000 | Prévision fausse | P0 | Entrée locale et probabilité converties deux fois | `MoneyInput` canonique, probabilité 0–100 appliquée une fois | Unitaire + création réelle 600,00 | DONE | `src/lib/money.ts`, `src/components/ui/money-input.tsx` |
| P0-STK-01 | Stock | Stock sans provenance | Quantité non auditable | P0 | Stock initial écrit sans registre garanti | Mouvement `initial_stock`, cumul mouvements = niveau = stock courant | Audit 15 produits + navigateur registre | DONE | `src/lib/product-actions.ts`, seed, audit |
| P0-TRS-01 | Trésorerie | Solde cockpit incohérent | Décision financière fausse | P0 | Read/modify/write concurrent et formules dispersées | Trigger delta atomique + invariant d’audit | Audit comptes et mouvements | IN PROGRESS | migration intégrité, `src/lib/treasury-actions.ts` |
| P0-TEN-01 | Multi-tenant | Relations potentiellement croisées | Fuite / corruption | P0 | Contrôles surtout applicatifs | Validations DB, RLS, scripts de preuve | Audit relations + matrice RLS | IN PROGRESS | migrations, audit sécurité |
| P0-REP-01 | Données | Historique incohérent | États financiers inexacts | P0 | Ancien seed non déterministe | Audit read-only, RPC dry-run/apply tenantée, journal de réparation | Dry-run obligatoire | IN PROGRESS | audit + migration repair + script repair |
| P1-SRC-01 | Stock | Réceptions sans lien source visible | Traçabilité interrompue | P1 | Loader ne cherchait que `sales_documents` | Résoudre aussi `purchase_documents`, liens typés | Navigateur registre stock | DONE | `src/lib/stock.ts`, table mouvements |
| P1-SRC-02 | Démo | Flux commande/réception/facture incohérent | Démonstration trompeuse | P1 | Liaisons sources aléatoires | Générateur par scénarios cohérents et audit des machines à états | Re-seed + audit | IN PROGRESS | `scripts/seed-demo-societe-demo.ts` |
| P1-RSP-01 | Responsive | Dashboard coupé à 375 px | Mobile bloquant | P1 | Piste Grid à largeur min-content | `minmax(0,1fr)`, `min-w-0`, confinement shell/cartes | Capture 375 px | DONE | AppShell, globals, dashboard, KPI |
| P1-SRH-01 | Recherche | Aucun résultat visible | Navigation bloquée | P1 | Fallback et erreurs silencieuses | Recherche tenantée, résultat catégorisé, état d’erreur | Recherche `FF-DEMO-00005` | DONE | recherche globale/API |
| P1-MOB-01 | Navigation | Aide/notifications masquées | Actions essentielles absentes | P1 | Actions topbar cachées sans relais | Raccourcis dans le tiroir mobile | Snapshot 375 px | DONE | sidebar/topbar/help/notifications |
| P2-DSH-01 | Dashboard | Top clients vide | KPI incomplet | P2 | Sélection d’une colonne `customer_name` inexistante | Charger IDs puis noms tenantés ; sommer les stocks multi-dépôts | Snapshot dashboard | DONE | `src/lib/dashboard-data.ts` |
| P2-UX-01 | Produit | Design, microcopy, tables, formulaires hétérogènes | Perception non premium | P2 | Évolution par modules sans modèle unique | Appliquer design system et modèles liste/détail/formulaire | Revue visuelle multi-breakpoints | PENDING | composants UI et écrans |
| P2-A11Y-01 | Accessibilité | Couverture clavier/labels/contrastes incomplète | Utilisateurs exclus | P2 | Contrôles historiques non audités | Audit WCAG 2.2 AA, correctifs et tests | Axe/Lighthouse + clavier | PENDING | application complète |
| P3-OBS-01 | Exploitation | Observabilité et analytics produit incomplets | Diagnostic lent | P3 | Pas de standard transverse | Journal structuré, événements, runbook | Tests de panne et revue | PENDING | docs et instrumentation |

