# Module documentaire actif — correction du parcours

La publication sur le site a été autorisée par l’utilisateur après cette recette. Le suivi de déploiement et les prérequis SQL figurent dans [le rapport de publication](PRODUCTION-RELEASE.md). Le resserrement des privilèges103 reproduit les privilèges par défaut Supabase ; les autres preuves HTTP et le manifeste initial restent les instantanés du commit86c7e48.

Branche `codex/e-invoicing-operational-20261031`, évolution de `b3544d9`. La sauvegarde du code avant correction est `../backups/felexia-before-einvoice-operations-20261031.bundle`. Les données et la passerelle de la recette initiale sur 55441 sont préservées ; la nouvelle recette utilise 55442. Le [manifeste de vérification](../../training/e-invoicing/20261031/operations-release.json) réunit les résultats et les empreintes des sources testées.

## Ce qui change pour l’utilisateur

- Le bandeau technique répété a été retiré. Le module présente la génération, le téléchargement et l’archivage des documents.
- L’état **Module actif** reflète l’installation disponible, l’autorisation serveur et le réglage de l’entreprise. Une installation incomplète ne produit pas un faux état actif.
- Le parcours courant comporte deux actions : **Générer mes documents**, puis **Émettre et archiver** après aperçu. La seconde action vérifie et émet la même version dans une seule transaction.
- **Télécharger PDF** est distinct de l’aperçu et du téléchargement XML. Les versions restent conservées et contrôlées.
- Une préparation incomplète conserve ses erreurs et n’affiche pas de faux message de documents générés. Un renvoi identique réutilise la version ; un formulaire périmé avec une nouvelle clé est refusé.
- Une unité habituelle choisie explicitement par l’administrateur préremplit les nouvelles lignes. Le traitement et le motif d’une TVA nulle restent explicites.
- Le statut principal demeure **Émise et archivée** même après un essai rejeté. Les simulations et outils administrateur sont repliés ; leurs résultats restent identifiés comme essais.
- Les états réels du connecteur, de la signature et du format sont conservés dans les options avancées de configuration. Aucun envoi fiscal ou signature qualifiée n’est inventé.
- Les factures et avoirs commerciaux proposent un accès direct à leurs documents électroniques. Les numéros, règlements et écritures comptables ne sont pas recréés.

Le mode de fonctionnement normal s’appelle **Documents et archivage**. Sa valeur technique `connector_mode=disabled` signifie que les échanges externes sont désactivés ; elle n’empêche pas la génération et l’émission documentaires.

## Activation et installation

Les migrations 102 **et103** sont nécessaires. Le nouveau RPC de lecture `einvoice_get_capabilities` confirme le parcours atomique disponible ; un ancien schéma102 seul permet encore de télécharger les archives mais bloque les nouvelles écritures et l’activation du nouveau parcours.

L’[installateur102–103](../../supabase/electronic-invoicing-102-103.sql) regroupe les deux migrations dans une transaction. La102 historique reste inchangée. Le résultat final affiche `facturation_electronique_102_active=true` et `facturation_operations_103_active=true`. La sauvegarde et la recette hébergée de la [checklist](RELEASE-CHECKLIST.md) restent requises avant une installation de production autorisée.

| Fichier | SHA256 |
|---|---|
|102|`b652c64a8e1a4e349dcaa61bb9b886bf2cf155ab4c034a42e3074b12df9cb354`|
|103|`f82118ea8aaf2b6cf49f94906c1884d2d4ad3ae37d0b7e45ae8f252076ae59b8`|
|Installateur102–103|`3f589eac13719793dafb5352a287ca71ee6fdad6a2973ff03dec5b105abe7c30`|

L’exploitant autorise l’entreprise via le déploiement serveur ; l’administrateur active ensuite le module dans sa configuration. Les droits d’abonnement et les rôles sont conservés. Les informations fiscales manquantes doivent être complétées avant génération.

## Résultats exécutés

| Vérification | Résultat et preuve |
|---|---|
|RPC atomique, rollback, version, idempotence, droits et readiness|**129 contrôles SQL** :43 sous PGlite strict,43 relâché,43 sous PostgreSQL natif — [strict](../../training/e-invoicing/20261031/operations-database-strict.json), [relâché](../../training/e-invoicing/20261031/operations-database-relaxed.json), [natif](../../training/e-invoicing/20261031/operations-database-native.json)|
|Passerelle et SDK, capacités des trois profils et refus croisés|**59/59**,52 requêtes — [preuve](../../training/e-invoicing/20261031/operations-gateway-probes.json)|
|Parcours complet sur base isolée neuve|**123/123**,118 requêtes — [preuve](../../training/e-invoicing/20261031/operations-flow.json)|
|Build optimisé Node22 exécuté sur 3103|**44/44**,33 requêtes — [preuve](../../training/e-invoicing/20261031/operations-build.json)|
|Pages et composants SSR|**48/48** — [preuve](../../training/e-invoicing/20261031/ui-operations.json)|
|Adaptateurs et intégrité, unités et séparation des états|**31/31** — [preuve](../../training/e-invoicing/20261031/server-operations-guards.json)|
|Installation partielle et état actif réel|**12/12** — [preuve](../../training/e-invoicing/20261031/operations-access.json)|
|Installateur transactionnel réapplicable et rollback|**5/5**,sources financières conservées — [preuve](../../training/e-invoicing/20261031/operations-installer.json)|

La recette utilise un administrateur, un opérateur, un lecteur et un compte d’une autre entreprise. Elle teste l’activation depuis un module désactivé, les unités, le français/arabe, les corrections, la génération PDF/XML, l’émission atomique, les téléchargements, l’expiration et les refus d’accès. L’essai de rejet est réalisé explicitement en mode simulation, puis le réglage final revient au mode documentaire. Il ne dégrade ni le statut d’émission, ni les compteurs métier.

Le serveur Next, les SDK, PostgreSQL, les calculs, les fichiers PDF/XML et leurs empreintes sont réels dans ce laboratoire. La façade Auth/REST et les identités sont des doubles de test locaux. Cette recette ne prouve pas Supabase Auth hébergé, SMTP, une connexion DGI ou une installation de production. Le [contrat du laboratoire](../../training/e-invoicing/20261031/operations-contract.json) donne les commandes et les limites.

La préproduction locale sur 3103 a été reconstruite avec le manifeste d’opérations privé, distinct de l’ancien laboratoire. Aucun secret n’est commité. Le build local contient des variables publiques de test et doit être reconstruit depuis les sources pour un déploiement hébergé.

Le contrôle visuel du build optimisé confirme le statut actif, la facture émise, les téléchargements PDF/XML et les outils avancés repliés, sans le bandeau cité. À 1280×720, la page ne déborde pas horizontalement. Voir [la capture de la facture](../../training/e-invoicing/20261031/operations-browser/invoice-issued-fr.png), [la supervision](../../training/e-invoicing/20261031/operations-browser/supervision-fr.png) et [les observations du navigateur](../../training/e-invoicing/20261031/operations-browser/browser-check.json).

Les régressions de la version légère (23 parcours,21 écrans sur demande et6 menus), les calculs métier existants et les10 fixtures d’impression passent également. Le lint de `src` et du laboratoire ne remonte aucune erreur. Ces contrôles ne remplacent pas une recette hébergée avec les services réels.

À la clôture de la recette initiale86c7e48, la production n’avait pas été modifiée. La publication a depuis été autorisée ; consulter le rapport de publication pour son état actuel. Les comptes, archives et données réels ne sont pas remplacés par les fixtures locales.
