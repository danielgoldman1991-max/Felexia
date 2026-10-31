# Vérification du lancement Felexia Pro — parcours nouvel abonné

Rapport du 31 octobre 2026. Le parcours financier est validé par **41 contrôles sur 41** dans `verification.json` et une nouvelle inscription après correctif par **14 contrôles sur 14** dans `signup-verification.json`. L’invitation a été reçue et acceptée depuis l’interface réelle. La migration 094 a ensuite été appliquée et vérifiée avec le compte invité : **17 contrôles réels réussis**. Le SMTP personnalisé reste à configurer et à tester avant le lancement public.

## Périmètre et preuves

- Entreprise fictive créée depuis l’interface : `c7728100-6e58-46b6-aa07-220b262169ab`.
- Facture de vente : `0c1d0c3e-7b4e-4e2e-a51e-21fc0f2f4bf1`.
- Facture d’achat : `f599229f-6f41-4ce3-9466-e24fa3e4b1b7`.
- Compte bancaire de test : `388c01de-736d-4ce7-81f0-e7d62c8e2175`.
- Correctifs de la release `41d6796` publiés en production. L’ajout de l’adresse aux impressions attend la publication suivante et son contrôle visuel.
- Preuve machine : `verification.json`, phase `final`, terminée à `2026-10-31T13:32:14.455Z`, résultat `success: true`. Le script utilise une connexion publique du compte administrateur et effectue des lectures, sans service role.
- Nouvelle entreprise créée après correctif : `e039622e-97f7-4b4d-9b32-916f166f79d2`. Preuve `signup-verification.json`, terminée à `2026-10-31T13:34:18.612Z`, `success: true`, 14 contrôles réussis.
- Preuve du défaut de permissions constaté avec le collaborateur : `viewer-role-boundary.json` ; la note de la facture de test a été restaurée après la sonde.
- Aucun mot de passe, adresse email, jeton ou lien d’authentification n’est inclus dans ce rapport. Les données de l’entreprise de test sont fictives.

## Parcours effectivement réalisé

### Création de l’entreprise

L’inscription initiale en production a créé le compte et son profil, puis échoué avec HTTP 400 sur `/api/auth/create-profile` : l’appel à deux paramètres était ambigu entre les signatures de `ensure_user_profile` (`PGRST203`). L’accès direct à l’onboarding a permis de poursuivre ce premier test.

L’entreprise a ensuite été créée depuis l’interface, avec un administrateur, un abonnement Essentiel en essai, les cinq journaux `VE`, `AC`, `BQ`, `CA`, `OD`, 29 comptes et 17 unités. La version initiale ne proposait que le rôle administrateur.

Une **nouvelle inscription réelle après publication de `41d6796`** a ensuite été effectuée. Les 14 contrôles de `signup-verification.json` confirment : un profil avec prénom/nom et métadonnées cohérents, un seul rattachement actif, une entreprise et une ligne de paramètres, aucun doublon visible, les quatre rôles `admin`, `viewer`, `sales`, `accountant`, cinq journaux et un seul abonnement Essentiel en essai. Ce nouvel essai commence le `2026-10-31T13:33:23.963Z` et se termine le `2026-11-30T13:33:23.963Z` : la fin au **30 novembre** est confirmée en base pour une création du 31 octobre.

### Factures et règlements

Les contrôles finaux rapprochent les documents, leurs lignes, les affectations, les règlements, les mouvements et les écritures du même tenant.

| Élément | Résultat observé |
| --- | --- |
| Facture de vente libre | HT 200 MAD + TVA 40 MAD = TTC 240 MAD, sans bon de livraison |
| Facture d’achat libre | HT 100 MAD + TVA 20 MAD = TTC 120 MAD, sans réception |
| Vente après règlements | 240 MAD réglés, reste 0, statut `paid` |
| Achat après règlement | 120 MAD réglés, reste 0, statut `paid` |
| Banque | Solde initial 0 ; solde final 120 MAD |
| Mouvements de trésorerie | 3, soit un par règlement ; flux net de 120 MAD |
| Comptabilité | 5 écritures `posted`, équilibrées avec leurs lignes et sans doublon de source |
| Codes comptables | Correspondent aux comptes du tenant |
| Stock | 0 mouvement créé par ce parcours de factures libres |
| Isolation entre entreprises | 11 contrôles de lecture RLS réussis avec le compte administrateur de test |

Les 11 contrôles RLS couvrent les organisations, membres, tiers, factures clients et fournisseurs, règlements clients et fournisseurs, comptes et mouvements de trésorerie, écritures et lignes comptables. Ils vérifient l’absence de données d’autres entreprises dans les lectures du compte de test. Ils ne valident pas, à eux seuls, les restrictions d’écriture du rôle `viewer`.

### Invitation et activation du collaborateur

Le test réel depuis l’interface a envoyé une invitation qui a été **reçue dans Gmail** ; l’horodatage du message observé est `13:30:51`. Le lien contenu dans cet email a été ouvert, un mot de passe de test choisi et l’activation effectuée.

Le collaborateur a atterri sur l’accueil affichant « Bonjour Équipier », avec le rôle `viewer` et la bonne entreprise. Aucune seconde entreprise n’a été créée par l’acceptation. La réception du mail et l’activation sont donc établies pour ce scénario.

La vérification suivante a **confirmé un défaut de droits** : avec son JWT public, le `viewer` pouvait modifier la note d’une facture de sa propre entreprise. Le test a affecté une ligne ; la note initiale a été restaurée (`originalNoteRestored: true`). Les lectures d’autres entreprises restaient interdites. Après 173 contrôles PostgreSQL isolés, l’utilisateur a appliqué `094_readonly_financial_documents.sql`. Le compte invité réel ne peut désormais modifier ni sa facture vente/achat, ni les règlements, le compte bancaire, un tiers, une écriture ou les paramètres d’entreprise : zéro ligne affectée et valeurs d’origine conservées. Le rapport `viewer-role-boundary-after-094-extended.json` confirme 17/17 contrôles, dont l’isolation entre entreprises et l’acceptation idempotente de l’invitation sans place ni membre supplémentaire.

## Défauts constatés et correctifs

| Défaut constaté | Correctif | Validation disponible |
| --- | --- | --- |
| Inscription : ambiguïté du RPC à deux paramètres | Réutilisation du helper profil avec signature explicite à cinq paramètres dans l’API et l’action d’inscription | Correctif `41d6796` en ligne ; nouvelle inscription réelle et 14/14 contrôles réussis |
| Message de confirmation email perdu et risque de chargement sans fin | Notice persistante, retour PKCE vers l’onboarding, `try/catch/finally`, prénom/nom conservés | Source corrigée ; parcours de confirmation d’une nouvelle inscription à vérifier |
| Seul rôle administrateur au démarrage | Rôles `viewer`, `sales`, `accountant` créés avant les autres référentiels ; défaut d’invitation sans privilèges administrateur | Quatre rôles présents sur la nouvelle entreprise ; collaborateur activé, défaut d’écriture confirmé et migration 094 encore à appliquer |
| Ancien flux d’invitation sans envoi | Envoi Supabase et flux d’acceptation sécurisés | Email reçu, lien ouvert, activation et bonne entreprise observés |
| Réglages initiaux pouvant échouer silencieusement | Contrôle des erreurs et message non bloquant de configuration incomplète | Source corrigée ; scénario d’échec volontaire non exécuté |
| Essai d’un mois au 31 octobre calculé au 1er décembre | Borne au dernier jour valide du mois cible | Six cas de régression ajoutés et nouvelle entreprise réellement bornée au 30 novembre ; premier tenant inchangé, pas de correction rétroactive |
| Affectation incohérente lors d’un règlement partiel | Synchronisation du montant de l’unique facture sélectionnée | État final documents/affectations/trésorerie vérifié par le script |
| Codes des comptes d’achat incohérents avec le tenant | Reprise des codes réels des comptes utilisés | Contrôle de correspondance des codes et des écritures réussi |
| Adresse de l’entreprise absente des impressions de facture | Ajout de `identity.address` avant ville/pays, uniquement dans les vues facture vente et achat | Cause confirmée ; publication suivante et contrôle des impressions encore attendus |

## Adresse et logo : constat précis

La facture de vente imprimable affichait l’entreprise, Casablanca et le pays, mais omettait l’adresse. Une lecture avec la session publique du compte de test a confirmé l’adresse fictive « Entreprise fictive de test — aucun siège réel » dans `organizations.address` et `company_settings.address`. Le résolveur d’identité conservait correctement cette valeur ; les listes de lignes de l’en-tête des deux factures l’omettaient.

Le correctif ajoute une seule ligne dans chacune des deux vues, sans modifier les autres impressions, le résolveur ou le composant de logo. Les champs `logo_url` et `logo_path` sont absents dans les deux tables du tenant de test : aucun logo n’a été importé pour ce scénario. Cela ne constitue pas un test visuel d’un logo d’entreprise personnalisé.

## Contrôles restant ouverts

| Vérification | État / limite |
| --- | --- |
| Inscription entièrement fraîche après `41d6796` | Réalisée : 14/14 contrôles réussis, entreprise unique et essai au 30 novembre |
| Confirmation email d’une inscription neuve | À effectuer séparément du flux d’invitation déjà validé |
| Droits d’écriture du rôle `viewer` | Défaut corrigé en base par 094 ; 17/17 contrôles réels réussis après application |
| SMTP personnalisé | L’utilisateur confirme qu’il n’est pas configuré ; l’envoi public par email reste bloqué jusqu’à configuration et test avec une nouvelle adresse |
| Adresse visible sur les impressions vente et achat | À contrôler après la publication du correctif minimal |
| PDF papier / impression | Non effectué ; l’aperçu HTML ne valide pas une sortie papier ou PDF |
| Logo personnalisé | Non testé : entreprise de test sans logo |
| Menu light et modules avancés masqués | Résultat final à consigner par l’agent principal |
| Lint, typage, régressions et build de la toute dernière publication | À consigner par l’agent principal |

## Configuration à terminer avant le lancement public

### SMTP personnalisé — action dans Supabase

L’utilisateur a confirmé l’absence de SMTP personnalisé. Le mail de test reçu via l’expéditeur par défaut ne suffit pas à valider l’envoi aux nouveaux abonnés du public.

Ouvrir les [paramètres SMTP du projet Supabase](https://supabase.com/dashboard/project/ljpeidkggogwafyvqcrz/auth/smtp), activer le SMTP personnalisé et renseigner directement dans ce tableau de bord les valeurs fournies par le prestataire :

- Hôte du service SMTP et port requis par ce prestataire.
- Identifiant et mot de passe SMTP.
- Nom d’expéditeur : **Felexia Pro**.
- Adresse d’expéditeur validée par le prestataire pour le domaine concerné.

Les identifiants et mots de passe doivent être saisis directement dans Supabase : **ne pas les transmettre dans le chat ni les enregistrer dans le dépôt ou ce rapport**. Après configuration, refaire une inscription et une invitation avec une nouvelle adresse autorisée par le propriétaire du test, puis vérifier la réception réelle et l’activation.

### URL de l’application et redirections

Dans la configuration des URL Supabase :

- Conserver le **Site URL** `https://felexia.pro`.
- Autoriser `https://felexia.pro/invitation*` et `https://felexia.pro/auth/callback*`.
- Ajouter les équivalents `https://www.felexia.pro/invitation*` et `https://www.felexia.pro/auth/callback*` si ces URL sont utilisées ou partagées.

La sonde d’une redirection avec `www` a montré un retour au Site URL quand cette variante n’était pas autorisée. Le code utilise l’URL canonique **sans `www`** ; ce chemin a fonctionné lors du test d’invitation réel. Les variantes `www` doivent être autorisées pour éviter ce repli lorsque de tels liens sont employés.

### Protection SQL des rôles de consultation

Appliquer manuellement le fichier `supabase/migrations/094_readonly_financial_documents.sql` dans l’éditeur SQL du projet de production. La migration ajoute des gardes restrictives aux écritures des membres en lecture seule et conserve les permissions existantes des autres rôles. Le test isolé a validé 173 contrôles PostgreSQL ; l’application en production reste à effectuer par l’utilisateur.

Après application, rejouer la sonde avec le compte `viewer` : lecture de sa propre entreprise autorisée, absence de lecture d’autres entreprises, et création/modification/suppression refusées. Vérifier également que l’administrateur peut toujours gérer ses propres documents. Tant que ce contrôle en production n’est pas concluant, les droits de consultation ne sont pas déclarés validés.

## Limites de la conclusion

Les résultats financiers, l’activation par invitation et une nouvelle inscription après correctif sont étayés. Ils ne valident pas encore la protection SQL du rôle `viewer` en production, le SMTP personnalisé ou les impressions après leur prochaine publication. Les observations d’interface et les preuves machine sont distinguées afin de ne pas déclarer réussis des parcours non exécutés.
