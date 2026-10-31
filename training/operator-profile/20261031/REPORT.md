# Profil Opérateur — Felexia Pro

Le profil `operator`, affiché **Opérateur**, permet les opérations quotidiennes dans l'entreprise active. Aucun membre existant ne reçoit automatiquement ce rôle.

| Fonction | Opérateur |
| --- | --- |
| Clients, fournisseurs, contacts | Créer et gérer |
| Factures vente/achat, avoirs | Créer et gérer les documents métier |
| Règlements et affectations | Enregistrer, affecter et réaffecter ; annuler les règlements non comptabilisés |
| Trésorerie et journaux | Consulter et exporter |
| Règlement déjà comptabilisé | Montant, compte et annulation protégés ; intervention de l'administrateur |
| Utilisateurs, rôles et habilitations | Administration refusée |
| Entreprise, abonnement, numérotation, comptes bancaires | Administration refusée |
| Écritures comptables et mouvements manuels de trésorerie | Création/modification refusées |
| Profil personnel, préférences, sécurité personnelle | Accessibles |

Les restrictions figurent dans la navigation, les formulaires, les actions serveur, les API sensibles et les politiques RLS de la migration 095. Le profil reste restreint même dans une entreprise ayant accès aux modules ERP complets.

## Vérifications réalisées

- Build production, typage et lint réussis sur les sources modifiées.
- Politique de routes : 15 parcours métier autorisés, 10 consultations, 29 refus, URLs malformées ou détournées refusées.
- API d'abonnement et d'onboarding : 56 assertions sur les véritables handlers, avec dépendances isolées ; aucun appel Stripe ou Supabase externe.
- Invitations : valeurs par défaut sûres, choix explicite de l'Opérateur et compatibilité des anciens formulaires vérifiés.
- HTTP réel local : 5/5 contrôles d'invitation sans email ni écriture métier, détail dans `legacy-invitation-http.json`.
- PostgreSQL : 266 contrôles, dont les véritables RPC de paiement, compteurs, affectations, annulations et mouvements bancaires ; cas V3 strict et V3 assoupli. La migration historique 002 et les codes automatiques clients/fournisseurs sont inclus. Les droits administrateur et comptable existants sont conservés.
- Contournements contrôlés : changements d'entreprise sur comptes/compteurs, administration par RPC, règlements comptabilisés, suppressions directes de documents et écritures comptables.

Les migrations 095 et 096 ont été appliquées manuellement et vérifiées avec les sessions publiques de l'entreprise QA. Le parcours complet passe **43/43 contrôles réels** : clients et fournisseurs avec codes automatiques, contact et adresse, brouillons vente/achat avec une ligne chacun, opérations quotidiennes autorisées, administration refusée et huit lectures d'isolation sans autre entreprise visible. Les six enregistrements temporaires ont été supprimés et leur absence vérifiée ; le rôle initial viewer a été restauré. Les montants/statuts financiers restent identiques, avec le solde bancaire de 120 MAD.

Le build de production servi localement passe également **26/26 contrôles HTTP** : formulaires métier accessibles, menu « Mon compte », pages administratives redirigées, API sensibles refusées, banque et écritures consultables sans modification. L'administrateur voit le choix « Opérateur » et sa description dans le formulaire d'invitation. Aucun email n'a été envoyé pendant ces tests.

La création d'un tiers avait révélé un compteur historique supplémentaire bloqué. La première installation de 096 n'était pas active, confirmée par une requête de lecture de la définition SQL. Après exécution de l'intégralité de 096, les trois vérifications SQL sont revenues vraies et le parcours complet a réussi. Les preuves avant/après sont conservées séparément.

## Publication vérifiée

La publication `7b0af84` est confirmée sur `www.felexia.pro` : **23/23 contrôles HTTP publics réussis**, plus **5/5 contrôles publics des anciens formulaires d'invitation**, sans email ni appel Stripe. Les formulaires métier sont accessibles, les routes administratives redirigées et les mutations administratives refusées. Le choix **Opérateur** et sa description ont aussi été observés dans le formulaire d'invitation du site public, sans envoyer d'invitation. Les rapports sont `operator-production-http.json` et `legacy-invitation-production-http.json`.

Une optimisation finale évite au rôle Opérateur de tenter l'initialisation administrative d'abonnement/modules lors de la lecture de ses pages. Le comportement d'accès de secours reste identique. **43 assertions dédiées** exécutent les véritables fonctions avec dépendances isolées : aucune écriture administrative pour l'Opérateur, initialisation administrateur préservée, même offre et mêmes modules de secours. Preuve : `read-bootstrap-unit.json`.

## Compatibilité et corrections nécessaires

Un ancien onglet d'invitation transmet encore `organizationId`. Le serveur l'accepte uniquement comme confirmation de l'entreprise de session ; une autre entreprise reste refusée avant toute création ou tout envoi.

Les tests réels des anciennes fonctions PostgreSQL ont également révélé trois ambiguïtés entre colonnes et paramètres de sortie dans les RPC de modification/annulation de règlements, ainsi qu'une colonne `updated_at` manquante sur les affectations fournisseurs. La migration les corrige sans changer les signatures des RPC.

## Reproduire

```powershell
npm run build
npm run typecheck
npm run lint -- src scripts/verify-operator-access.ts scripts/verify-operator-api-guards.mjs scripts/verify-operator-profile.mjs scripts/verify-invitation-roles.ts
npx tsx scripts/verify-operator-access.ts
npx tsx scripts/verify-invitation-roles.ts
node scripts/verify-operator-api-guards.mjs
node scripts/verify-operator-read-bootstrap.mjs
node scripts/verify-operator-profile.mjs --pglite-root="$env:TEMP/felexia-invitation-postgres-tests"
node scripts/verify-operator-profile.mjs --pglite-root="$env:TEMP/felexia-invitation-postgres-tests" --relaxed-v3
```

Le dernier script utilise uniquement PostgreSQL jetable. Aucun secret, email de test, mot de passe ou session n'est inclus dans les rapports.
