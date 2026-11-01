# Installation manuelle — correctifs de lancement105–107

Fichier à exécuter dans l'éditeur SQL Supabase :

`C:/Users/XXX/Documents/Felexia/Felexia/supabase/launch-fixes-105-107.sql`

SHA-256 du fichier complet :

`7967b1409ecd7c91f7e8b32073d7385c43f7558350a19ac7e49d1d5f8ad37394`

## Installation

1. Utiliser le projet Felexia habituel où104 et ses prérequis sont déjà appliqués. Le bundle n'active aucun plan PRO, ne crée aucune entreprise et ne change aucun compte, numéro, salaire, taux, solde ou document existant.
2. Copier **le fichier complet**, puis l'exécuter en une seule fois. Il possède un seul `BEGIN` et un seul `COMMIT` pour les trois migrations. Ne pas découper les blocs.
3. Le dernier tableau doit contenir une ligne avec les quatre résultats suivants :

| Indicateur | Attendu |
| --- | --- |
| `launch_105_106_107_actif` | `true` |
| `pro_105_actif` | `true` |
| `pro_106_actif` | `true` |
| `treasury_107_actif` | `true` |

Si une erreur survient avant le `COMMIT`, toute l'installation est annulée ; si l'éditeur garde la transaction en erreur, terminer par `ROLLBACK;`. Corriger la cause puis réexécuter le fichier complet. Ne pas appliquer manuellement des fragments pour contourner l'erreur.

Le bundle peut être réappliqué. Il doit précéder la publication du code utilisant les nouveaux RPC. Les procédures absentes sont refusées par ce code avant toute ancienne suppression/insertion séparée.

## Sources revues

Le contenu des migrations est conservé ; seuls leurs `BEGIN`/`COMMIT` externes sont retirés pour l'enveloppe unique. Les indicateurs individuels sont conservés, puis regroupés dans le dernier résultat.

| Source | SHA-256 |
| --- | --- |
| `105_pro_commercial_transactions.sql` | `cc7c5e690766e2355bf3c0c999ece6fc9bef8af9f3d72a2c5afa5557ee0d43cf` |
| `106_preparatory_payroll_transactions.sql` | `d7c56e0f41eb02a2c142248562b406a36e74365b30d72ced25d69237e33c59f1` |
| `107_treasury_default_account_atomic.sql` | `5eb6b6f579c3498199ffd44cace03466b9fa9425b57e648c9c8dc35cee5802c2` |

Générateur reproductible : `training/launch-fixes/20261101/essential/build-installer.cjs`, qui refuse une source différente de ces empreintes.

## Retour arrière applicatif

Conserver les fonctions, contraintes et triggers en base : **ne supprimer ni données ni protections**.

1. Mettre les écritures concernées en maintenance avant tout retour à l'ancien code. Cet ancien code peut écrire directement les tables sans passer par les nouveaux RPC ; la révocation des RPC seule ne ferme donc pas ses anciennes actions.
2. Si le retour applicatif est décidé, exécuter séparément `C:/Users/XXX/Documents/Felexia/Felexia/supabase/launch-fixes-105-107-disable-rpcs.sql`. Il retire `EXECUTE` sur les six RPC publics pour PUBLIC/anon/authenticated/service_role et conserve toutes les lignes métier et gardes. Résultat attendu : `launch_105_106_107_rpc_desactives = true`.
3. Pour reprendre les écritures, réinstaller d'abord le code corrigé, puis réappliquer le bundle complet105–107. Il rétablit les seuls octrois prévus à `authenticated`. Rejouer la recette QA avant la fin de maintenance.

SHA-256 du script de désactivation : `20940028c0929dfb2b7e506f72b0d700f3e6cb40dd32d90a25c951088ba85049`.

## Preuves locales

`training/launch-fixes/20261101/essential/installer-105-107-strict.json` et `installer-105-107-relaxed.json` : installation, réapplication, panne injectée au début107 après création105/106, rollback des RPC/triggers/contraintes, données fictives préexistantes préservées, désactivation et réactivation des RPC, puis tous les scénarios métier/permissions de la suite intégrée. Les octets du bundle sont effectivement exécutés dans PGlite jetable. Aucun SQL hébergé n'a été exécuté par cette préparation.

La vérification hébergée des indicateurs et la recette Next→RPC après installation restent distinctes des preuves locales. Les tests ne prétendent ni une concurrence native multi-connexion ni une transmission DGI ou une paie officielle.
