# ERP complet et protections PRO — 01/11/2026

La sauvegarde `codex/backup-erp-complet-20261031` pointe sur `c6fd5c3d589c11969a462f2ade62616d10a439a9`. Aucun fichier métier de `src` n’a été supprimé depuis cette sauvegarde. Les modules complets sont toujours dans la base de code, avec les corrections ultérieures de finance, d’accès, de numérotation et d’impression. Leur restauration consiste à ouvrir les accès de l’offre PRO, sans remplacer les sources par l’ancienne sauvegarde.

## Modèle retenu

Le nom commercial PRO conserve le code durable `premium`. Ce code est déjà référencé par les abonnements, Stripe et les quotas SQL. Il conserve 25 utilisateurs et un volume illimité de documents commerciaux. Le code `business` reste compatible avec les anciens abonnements. Essentiel garde ses limites et son essai existants.

Les migrations098–101 imposent MAD aux nouveaux flux de trésorerie, règlements, avoirs et à leur comptabilisation, quel que soit le plan. L’interface PRO conserve cette contrainte. Le fait de réafficher des modules complets ne constitue pas un support multidevise.

## Installation manuelle104

Fichier : `supabase/migrations/104_pro_erp_write_access.sql`.

SHA256 : `761fae996972488b18e8360c21d2135eccde986a86ef0b721d264f2705d0438a`.

L’utilisateur a confirmé l’application manuelle et l’indicateur `true` pendant cette session. Le contrôle public authentifié de la capacité hébergée réussit ensuite 21 assertions, sans changement de plan ni de donnée métier.

Le script est transactionnel. Il ne réécrit aucune société, donnée métier, souscription, échéance, numéro ni devise. Il n’attribue PRO à aucune entreprise. Les gardes existantes de rôles et de locataire restent actives.

1. Appliquer104 dans l’éditeur SQL du projet cible après les migrations déjà installées.
2. Vérifier le résultat final `pro_104_actif = true`.
3. Avec une session membre, le RPC `erp_get_capabilities(p_organization_id)` doit retourner `{ "workflow_version": 104, "pro_write_guards": true }`.
4. Vérifier les deux offres, le parcours PRO et les droits sur une société de recette dédiée avant publication.

Le contrôle final de la migration ne lit que le catalogue PostgreSQL. Le RPC est réservé aux membres authentifiés de l’entreprise demandée ; les droits `public`, `anon` et `service_role` sont explicitement révoqués.

## Portée des protections

Les déclencheurs bloquent les écritures des modules RH, stock, logistique des ventes/achats, GED, déclarations/exports TVA et fonctions avancées de trésorerie sans abonnement valide ni plan PRO. Ils s’exécutent aussi lorsqu’un RPC utilise `SECURITY DEFINER`. Les identifiants et l’entreprise d’une ligne protégée restent immuables. Les rôles viewer et opérateur ne gagnent aucun droit avancé.

Les mutations de stock générées par un autre déclencheur SQL restent admises pour une opération Essentiel autorisée, avec contrôle de l’abonnement. Un appel direct au stock exige PRO. Les règles RLS précédentes continuent de s’appliquer. La création courante des factures Essentiel reste autorisée.

Les écritures Storage des seuls buckets GED, RH et TVA exigent une entreprise dans le chemin et les mêmes droits. Les politiques de téléchargement et de lecture ne sont pas modifiées, de même que les buckets de logos et de pièces jointes existantes. Les anciennes politiques de lecture RH Storage ne sont pas auditées ni certifiées par ce lot.

Les comptes comptables partagés restent nécessaires à l’initialisation et aux écritures Essentiel. Leurs mutations manuelles sont protégées dans l’application ;104 ne place pas un verrou PRO global sur cette table afin de conserver l’initialisation comptable courante. Les variables serveur historiques d’ouverture complète autorisent l’interface, mais ne remplacent pas le plan PRO dans les gardes SQL.

Les actions RH vérifient l’accès complet, l’échéance et les rôles de gestion existants (owner/admin/hr_manager/accountant) avant tout effet. Les lecteurs et les abonnements expirés n’initialisent plus les références. Les réglages RH déjà présents ne sont plus réécrits par l’initialisation.

Les liens Nouveau/Modifier et le calcul de paie sont également masqués au rendu serveur pour les lecteurs et les abonnements expirés, avec le même contrôle de droits. La revue React du composant serveur partagé confirme l’absence de nouvel état client, d’effet ou de dépendance, et conserve les libellés accessibles.

## Vérifications

- `production-schema.json` : GET OpenAPI uniquement ; tables avancées et neuf RPC constatés, aucune ligne métier lue ni écrite.
- `database-strict.json` et `database-relaxed.json` : 44 assertions chacune, PostgreSQL via PGlite jetable, migrations réelles082/099/104, réinstallation, droits Essentiel/PRO, rôles, locataire, échéance, RPC definer, uploads, quotas, rollback manuel idempotent et réinstallation104, puis rollback des fixtures.
- `hr-guards.json` : 37 assertions sur les vrais modules TypeScript, frontières session/base remplacées ; les six actions refusées ne créent pas de client de base et les contrôles visuels suivent les mêmes droits.
- `production-readonly.json` : 21 assertions après installation manuelle104 ; capacité membre, refus anonyme/nonmembre, lectures de quatorze tables et empreintes financières identiques avant/après. Aucun champ d’abonnement, utilisateur ou métier modifié.
- Lint ciblé des services RH, composants RH et page de calcul de paie réussi.

Reproduction locale (les dépendances QA restent hors du projet) :

```powershell
node training/pro-offers/20261101/verify-pro-database.mjs --pglite-root="$env:TEMP/felexia-invitation-postgres-tests"
node training/pro-offers/20261101/verify-pro-database.mjs --pglite-root="$env:TEMP/felexia-invitation-postgres-tests" --relaxed-v3
node training/pro-offers/20261101/verify-hr-guards.cjs
```

## Retour arrière

Le script `supabase/rollback/104_pro_erp_write_access.sql` retire uniquement les déclencheurs, les trois restrictions Storage et les fonctions ajoutées par104. Il ne retire aucune protection098–103 et ne supprime aucune donnée. Restaurer d’abord l’ancienne application : retirer104 rétablit les anciens droits de base et ne convient pas à une application qui commercialise PRO. Le script de retrait est vérifié deux fois de suite dans la base jetable, avec conservation des lignes métier et des déclencheurs099, puis réinstallation104. Il reste destiné à une intervention manuelle, sans exécution en production par cet agent.

Les tests locaux ne constituent ni un paiement Stripe réel, ni une vérification de tous les formulaires navigateur, ni une certification fiscale/sociale. Les fonctions RH et fiscales préparatoires conservent leur statut.
