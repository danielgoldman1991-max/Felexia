# Vérification du lancement Felexia Pro — parcours nouvel abonné

Rapport final du 31 octobre 2026. La version **`d6f20b89` est en production**. Les parcours testés couvrent la création d’entreprise, les factures libres de vente et d’achat, leurs règlements, la trésorerie, les journaux, l’invitation réelle d’un collaborateur et la protection du rôle de consultation.

**Le seul prérequis bloquant restant pour l’ouverture publique par email est la configuration et la validation du SMTP personnalisé.** Il est confirmé non configuré. Les limites de vérification restantes sont indiquées en fin de rapport.

## Entreprises et preuves de test

Les deux entreprises utilisées sont fictives ; aucun mot de passe, adresse email, jeton ou lien d’authentification n’est inclus dans ce rapport.

- Entreprise du parcours financier et de l’invitation : `c7728100-6e58-46b6-aa07-220b262169ab`.
- Entreprise d’une nouvelle inscription après correctif : `e039622e-97f7-4b4d-9b32-916f166f79d2`.
- Facture de vente : `0c1d0c3e-7b4e-4e2e-a51e-21fc0f2f4bf1`.
- Facture d’achat : `f599229f-6f41-4ce3-9466-e24fa3e4b1b7`.
- Compte bancaire de test : `388c01de-736d-4ce7-81f0-e7d62c8e2175`.

| Preuve enregistrée | Résultat | Périmètre vérifié |
| --- | --- | --- |
| `verification.json` | **41/41 réussis** | Documents, TVA, règlements, affectations, banque, écritures, absence de stock et 11 lectures d’isolation entre entreprises |
| `signup-verification.json` | **14/14 réussis** | Nouvelle inscription réelle, profil, entreprise, rôles, journaux et abonnement uniques |
| `viewer-role-boundary-after-094-extended.json` | **18/18 réussis** | Droits réels du collaborateur après migration 094 et conservation de l’écriture autorisée de l’administrateur |
| `viewer-http-boundary.json` | **10/10 réussis** | Interface et réponses HTTP de la version publiée pour le collaborateur et l’administrateur |
| `export-verification.json` | **13/13 réussis sur le nouveau fichier** | Journal bancaire réellement téléchargé après publication ; ancien résultat conservé pour traçabilité |

Les vérifications de production ont utilisé les sessions publiques des comptes de test. Les contrôles de lecture ne reposent pas sur un service role qui contournerait les restrictions.

## Parcours réellement validés

### Nouvelle inscription et création d’entreprise

L’inscription initiale avait créé le compte et son profil, puis échoué avec HTTP 400 sur `/api/auth/create-profile` : l’appel à deux paramètres était ambigu entre les signatures de `ensure_user_profile` (`PGRST203`). L’ouverture directe de l’onboarding avait permis de poursuivre ce premier scénario. Ce défaut a été corrigé ; une nouvelle inscription complète a ensuite été réalisée depuis l’interface après publication.

Les **14 contrôles réussis** de cette nouvelle inscription confirment un profil avec prénom, nom et métadonnées cohérents, un seul rattachement actif, une entreprise et une ligne de paramètres, aucun doublon visible, les rôles `admin`, `viewer`, `sales`, `accountant`, les cinq journaux `VE`, `AC`, `BQ`, `CA`, `OD`, et un seul abonnement Essentiel en essai.

Le nouvel essai commence le `2026-10-31T13:33:23.963Z` et se termine le `2026-11-30T13:33:23.963Z` : sa fin au **30 novembre** est confirmée en base pour une création le 31 octobre. Le premier tenant, créé avant ce correctif, conserve sa date initiale ; aucune modification rétroactive de son abonnement n’a été effectuée.

Le premier scénario avait également confirmé la création de 29 comptes et 17 unités. La reconnexion de l’administrateur depuis l’interface revient à la bonne entreprise et à ses journaux.

### Factures, règlements et trésorerie

Les documents ont été saisis directement, sans article de stock, livraison ou réception imposés. Les contrôles rapprochent les factures, lignes, affectations, paiements, mouvements et écritures du même tenant.

| Élément | Résultat observé |
| --- | --- |
| Facture de vente libre | HT 200 MAD + TVA 40 MAD = TTC 240 MAD |
| Facture d’achat libre | HT 100 MAD + TVA 20 MAD = TTC 120 MAD |
| Vente après règlements | 240 MAD réglés, reste 0, statut `paid` |
| Achat après règlement | 120 MAD réglés, reste 0, statut `paid` |
| Banque | Solde initial 0 ; solde final 120 MAD |
| Mouvements de trésorerie | 3, soit un par règlement ; flux net de 120 MAD |
| Comptabilité | 5 écritures `posted`, équilibrées avec leurs lignes et sans doublon de source |
| Codes comptables | Correspondent aux comptes de l’entreprise |
| Stock | 0 mouvement créé par ce parcours de factures libres |
| Isolation entre entreprises | 11 lectures RLS réussies avec l’administrateur de test |

Les contrôles d’isolation couvrent les organisations, membres, tiers, factures, paiements, comptes et mouvements de trésorerie, écritures et lignes comptables. La consultation réelle du journal bancaire après reconnexion affiche **3 lignes, débit 360 MAD, crédit 360 MAD, différence 0**.

### Invitation réelle et activation du collaborateur

L’invitation envoyée depuis l’interface a été **reçue dans Gmail**, avec l’horodatage de message observé `13:30:51`. Le lien de cet email a été ouvert, le mot de passe de test choisi et l’activation effectuée.

Le collaborateur a atterri sur l’accueil « Bonjour Équipier », avec le rôle `viewer` et la bonne entreprise. L’acceptation n’a créé aucune seconde entreprise. La répétition de l’acceptation conserve le membre et son rôle sans consommer de place supplémentaire.

### Droits du rôle de consultation

Une sonde initiale avait confirmé un défaut : le JWT public du `viewer` pouvait modifier la note d’une facture de sa propre entreprise. La note d’origine a été restaurée après ce constat. Ce résultat est conservé dans `viewer-role-boundary.json` comme preuve historique.

La migration **094 a ensuite été appliquée réellement en production**. Les **18 contrôles réussis** de `viewer-role-boundary-after-094-extended.json` confirment les lectures autorisées dans la bonne entreprise, l’absence de lecture d’autres entreprises et le refus de modification des factures de vente et d’achat, règlements, compte bancaire, tiers, écriture et paramètres de l’entreprise. Les valeurs d’origine restent conservées. L’écriture de l’administrateur sur sa propre facture reste autorisée.

La version `d6f20b89` a également passé **10 contrôles HTTP réels** : accueil du collaborateur en HTTP 200 avec bannière de lecture seule et actions de consultation, absence de création rapide, redirection HTTP 307 d’une nouvelle facture et refus HTTP 403 du POST testé. L’administrateur conserve sa création rapide et l’accès HTTP 200 à la nouvelle facture et au POST de contrôle.

Le test isolé de la migration avait auparavant validé 173 contrôles PostgreSQL ; les preuves publiques effectuées après son application apportent la vérification complémentaire en production.

### Navigation, impressions et export

Les **six entrées du menu light** sont visibles en production : Accueil, Ventes, Achats, Trésorerie, Journaux et Paramètres. Les modules complémentaires sont proposés sur demande.

Les aperçus HTML des impressions de facture de vente **et** d’achat affichent désormais correctement l’adresse fictive de l’entreprise avant ville et pays. La cause du défaut était une omission dans les lignes de l’en-tête ; les données étaient déjà correctement enregistrées. Le correctif a ajouté une ligne dans chacune des deux vues, sans modifier les autres impressions, le résolveur d’identité ou le composant de logo.

Les champs `logo_url` et `logo_path` sont absents dans les deux tables du premier tenant de test : aucun logo personnalisé n’a été importé pour ce scénario. Ce constat ne valide pas visuellement le rendu d’un logo d’entreprise.

Le journal bancaire a été téléchargé de nouveau depuis la production après `d6f20b89`, dans un fichier portant le suffixe `(1).xls`. Son format est un document HTML UTF-8 compatible Excel avec extension `.xls`, et non un classeur binaire XLS ou XLSX. Les **13 contrôles sur 13** du nouveau fichier sont réussis : en-tête de la bonne entreprise, trois références uniques attendues, six lignes comptables, débit 360 MAD, crédit 360 MAD et solde net bancaire de 120 MAD. La comparaison du nom d’entreprise neutralise la casse. L’ancien fichier, qui échouait sur l’en-tête, reste documenté séparément dans `export-verification.json` pour la traçabilité.

## Défauts corrigés pendant le parcours

| Défaut historique | Correction et résultat |
| --- | --- |
| Inscription bloquée par l’ambiguïté du RPC profil | Helper avec signature explicite ; nouvelle inscription réelle validée, 14/14 contrôles |
| Message de confirmation perdu et risque de chargement sans fin | Notice persistante, retour PKCE, prénom/nom conservés et gestion des erreurs ; confirmation par email non exercée car l’auto-confirmation est active |
| Administrateur seul rôle proposé au premier démarrage | Rôles `viewer`, `sales`, `accountant` créés ; valeurs présentes sur la nouvelle entreprise |
| Invitation locale sans email | Envoi Supabase et activation revus ; email réellement reçu et accepté |
| Écriture possible avec le rôle de consultation | Migration 094 appliquée, interface adaptée et protections HTTP ; 18/18 contrôles en base et 10/10 HTTP réussis |
| Essai débordant du 31 octobre au 1er décembre | Fin de mois bornée ; nouvelle création réellement limitée au 30 novembre |
| Affectation incohérente lors d’un règlement partiel | Synchronisation de la facture sélectionnée ; affectations, soldes et mouvements rapprochés |
| Codes des comptes d’achat incohérents | Codes réels repris ; écritures équilibrées et correspondance avec les comptes vérifiée |
| Adresse absente des impressions de facture | Adresse ajoutée aux deux en-têtes et observée dans les aperçus HTML en production |
| Nom d’entreprise absent de l’en-tête d’export du journal | En-tête complété ; nouveau téléchargement réel après publication, 13/13 contrôles réussis |

Les contrôles techniques finaux sont réussis : build de production, typage TypeScript, lint de `src` et des quatre scripts concernés, régressions métier, règles light, callbacks d’invitation et rôles. Le scénario d’échec volontaire des réglages initiaux n’a pas été exécuté ; la gestion non bloquante de cette erreur reste vérifiée par lecture des sources.

## Seule configuration bloquante : SMTP personnalisé

L’utilisateur a confirmé l’absence de SMTP personnalisé. Le mail de test reçu via l’expéditeur par défaut ne valide pas l’envoi aux nouveaux abonnés du public.

Ouvrir les [paramètres SMTP du projet Supabase](https://supabase.com/dashboard/project/ljpeidkggogwafyvqcrz/auth/smtp), activer le SMTP personnalisé et saisir directement les valeurs du prestataire :

- Hôte du service SMTP et port requis.
- Identifiant et mot de passe SMTP.
- Nom d’expéditeur : **Felexia Pro**.
- Adresse d’expéditeur validée par le prestataire pour le domaine concerné.

Les identifiants et mots de passe doivent être saisis directement dans Supabase : **ne pas les transmettre dans le chat ni les enregistrer dans le dépôt ou ce rapport**. Après configuration, tester la réception réelle d’une invitation et d’un email de confirmation d’inscription auprès d’une nouvelle adresse autorisée par le propriétaire du test.

### URL et variantes de domaine

Le **Site URL** est `https://felexia.pro`. Les motifs utiles sont `https://felexia.pro/invitation*` et `https://felexia.pro/auth/callback*`, avec les équivalents `https://www.felexia.pro/invitation*` et `https://www.felexia.pro/auth/callback*` lorsque ces variantes sont employées.

Une sonde d’invitation avec `www` a montré un repli vers le Site URL quand cette variante n’était pas autorisée. Le code utilise l’URL canonique sans `www` ; l’invitation réelle a fonctionné sur ce chemin. Ce constat ne remet pas en cause les contrôles HTTP réalisés sur la version publiée.

## Limites restantes de vérification

- SMTP externe : non configuré et non validé ; prérequis de lancement public restant.
- Confirmation email d’une nouvelle inscription : non exercée, l’auto-confirmation étant active pendant le test. Le flux d’invitation par email a bien été exercé.
- Impression papier ou génération locale d’un PDF : non effectuée. Les deux aperçus HTML ont été vérifiés.
- Logo personnalisé : non testé, l’entreprise de test n’ayant pas de logo.

Ces limites sont distinctes des parcours effectivement réalisés et des preuves de production enregistrées ci-dessus.
