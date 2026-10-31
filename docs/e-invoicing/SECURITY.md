# Sécurité de la préparation électronique

État vérifié le 31 octobre 2026. Ce module prépare des factures clients et des avoirs clients sortants. Il ne constitue ni une connexion DGI, ni une signature électronique, ni une certification de conformité fiscale marocaine. Les pièces fournisseurs ne sont pas réémises par ce module.

## Frontières de confiance

Le navigateur choisit une référence de pièce et renseigne ses précisions fiscales. L’entreprise et l’utilisateur proviennent de la session serveur. Le serveur relit la pièce par RPC, vérifie les données, calcule les montants et produit les archives. Les résultats de validation et les fichiers ne sont jamais acceptés comme une preuve fiable fournie par le navigateur.

La migration `102_electronic_invoicing_maroc.sql` réserve `einvoice_save_preparation`, la prise et la clôture des travaux, et l’ajout d’événements d’audit au rôle de service. Les contrôles de rôle et d’abonnement sont également exécutés par les fonctions SQL. Les utilisateurs authentifiés peuvent lire les lignes de leur entreprise selon RLS ; ils ne disposent pas d’un accès direct permettant de forger les états des documents ou les archives. Une compromission du rôle de service reste une compromission de cette frontière de confiance : PostgreSQL ne réexécute pas lui-même le moteur XSD du serveur.

## Entreprise, profils et abonnement

- L’administrateur configure le module et déclenche les simulations internes.
- L’administrateur et l’opérateur préparent et font avancer les documents autorisés ; le lecteur consulte et télécharge.
- Une adhésion inactive ou une pièce d’une autre entreprise est refusée par SQL.
- Un abonnement expiré conserve la lecture des archives. La préparation, l’émission et les nouvelles opérations de simulation exigent un abonnement permettant l’écriture.
- L’activation de déploiement est un contrôle serveur supplémentaire. Elle ne remplace pas la configuration par entreprise ni les contrôles SQL.

Les références croisées organisation/document/version sont contraintes en base. Les versions sont ajoutées plutôt qu’écrasées. Les vérifications de version attendue et les clés d’idempotence évitent qu’une réponse perdue crée discrètement une nouvelle version.

## Intégrité des données et calculs

Les valeurs monétaires traversent la capture PostgreSQL sous forme de chaînes décimales. Le moteur utilise des entiers `BigInt` ; il ne calcule pas les montants par flottants IEEE754. La politique reproduit la chaîne PostgreSQL : quantité à trois décimales, prix et taux à deux, brut arrondi, remise arrondie, net, puis TVA arrondie par ligne et sommation. Les totaux de chaque ligne et de la pièce sont comparés aux montants métier d’origine. Une différence bloque la génération valide.

Le HT des ventes est déjà net de remise. Les remises sont portées aux lignes UBL ; la remise globale vaut zéro. Le montant payable de l’archive est le TTC de la pièce, avec prépaiement à zéro : les règlements ultérieurs n’altèrent pas le document fiscal préparé. Une TVA nulle nécessite une catégorie et un motif explicites ; le logiciel ne déduit pas un régime fiscal de la seule valeur zéro.

Trois empreintes répondent à des objectifs différents :

1. `source_fingerprint` identifie les faits relus en base, selon la représentation JSONB PostgreSQL.
2. `configuration_fingerprint` identifie les quatre options fiscales persistées : `buyer_type`, `require_seller_rc`, `default_unit_code`, `line_metadata`. Un changement de langue, d’alertes ou de mode du connecteur ne modifie pas cette empreinte fiscale.
3. Les empreintes du snapshot, du XML brut, du XML canonique et du PDF identifient leurs contenus exacts. La sérialisation JSON stable Felexia est une convention interne, sans affirmation de conformité RFC8785.

Avant émission, SQL vérifie à nouveau la source et la configuration fiscale. Les archives émises sont protégées contre un remplacement silencieux ; les modifications du document métier qui changeraient son contenu public sont bloquées. Les règlements restent possibles.

## XML, schémas et ressources

Le validateur est `libxml2-wasm` **0.7.2**. Les quinze fichiers XSD nécessaires aux racines Invoice et CreditNote proviennent du jeu officiel OASIS UBL2.1 et sont conservés localement avec leur taille, leur URL et leur SHA256 dans `src/lib/e-invoicing/schemas/ubl-2.1/manifest.json`. Le SHA256 du manifeste est `b9a63cb97a977f58255e247e7307d75bc2f4d5f3b6c5a19ed5552df8e5521606`.

Le chargeur d’entrées est fermé : seuls les chemins du jeu local vérifié sont résolus. Il n’effectue aucune récupération réseau. L’analyse utilise notamment NONET, NO_XXE et NO_SYS_CATALOG. Les documents non fiables contenant une déclaration DTD ou ENTITY sont refusés avant analyse. Le schéma XMLDSig officiel contient une DTD **interne** connue : cela concerne uniquement le fichier de schéma épinglé et ne permet pas aux documents utilisateur d’en fournir une.

Des limites explicites encadrent les ressources : 500 lignes, snapshot de 1,5Mo, XML de 2Mo et nombre de balises limité ; les archives SQL sont plafonnées à 4Mo. Les caractères interdits XML et les demi-surrogates UTF16 isolés sont refusés. La canonicalisation réelle est C14N1.1 ; son empreinte est une preuve technique de contenu, pas une signature qualifiée.

La conformité au XSD UBL générique vérifie une structure XML. Elle ne prouve pas la validité fiscale de chaque donnée, l’exactitude des régimes de TVA, l’existence d’un profil national ou une acceptation par la DGI.

## Archives, journal et secrets

Les fichiers archivés sont conservés en base avec taille et SHA256 recalculés. Les événements sont séquencés et chaînés par empreinte pour rendre visibles les incohérences ; les déclencheurs empêchent les modifications ordinaires. Cette protection ne constitue pas un stockage WORM, un horodatage qualifié ou une garantie contre un administrateur d’infrastructure disposant des moyens de modifier le schéma ou de désactiver ses protections.

Les métadonnées d’audit sont limitées en taille et refusent les champs de mots de passe, jetons, cookies, clés privées et contenus d’archives. Les rapports de test ne doivent pas contenir les secrets, les fichiers clients ou les liens de connexion. Aucun secret de prestataire de signature et aucune clé privée ne sont acceptés par le connecteur actuel.

Les sauvegardes, les durées de conservation légales, la restauration indépendante et la maîtrise des accès d’infrastructure doivent être organisées par l’exploitant. Une déclaration humaine de sauvegarde dans l’interface n’est pas une restauration cloud vérifiée automatiquement.

## Preuves exécutées et limites

Les résultats sont conservés dans `training/e-invoicing/20261031/` :

- `domain-tests.json` : 55 contrôles réels du domaine, décimaux, UBL Invoice/CreditNote, XSD, C14N et connecteur ; aucun appel réseau observé, y compris avec `fetch` interdit.
- `decimal-postgres-parity.json` : 405 cas, soit 3645 comparaisons avec le calcul `numeric` PostgreSQL d’une base PGlite jetable.
- `database-strict.json`, `database-relaxed.json`, `database-native.json` : 135 contrôles SQL par configuration, incluant tenant, rôles, archives, empreintes, idempotence, expiration, travaux, révocation de l’acteur et reprises. La preuve native utilise PostgreSQL ; les autres utilisent son moteur via PGlite.
- `database-concurrency.json` : 30 contrôles de courses sur PostgreSQL natif. `database-restore.json` : 11 contrôles d’une restauration locale d’un dump fictif incluant les archives ; aucune restauration de Supabase hébergé ou de données de production n’est revendiquée.
- `local-gateway-probes.json` : 50 contrôles HTTP avec le SDK Supabase sur la passerelle locale, dont signatures refusées, relations d’adhésion réelles, isolation entre entreprises, transport des tableaux UUID et RPC réellement autorisées ou refusées par SQL.
- `next-flow.json` : 94 contrôles du parcours réel HTTP Next sur une base fraîche, avec formulaires multipart SSR, versions PDF français/arabe, préférence arabe et surcharge française explicite, téléchargements, émission, idempotence, simulations et reprises bornées. Les quatre archives sont également relues par le rôle service selon le transport bytea hexadécimal de PostgREST, avec comparaison des longueurs et des empreintes.
- `next-permissions.json` : 10 contrôles HTTP supplémentaires des droits, de l’origine des POST, des versions croisées et de l’absence de session.
- `next-production-build.json` : 35 contrôles du build Next optimisé exécuté **localement** sur le port3103 sous Node22.23.4, dont l’intégrité réelle XSD/C14N, les archives et des écritures refusées. Il ne s’agit pas d’un test du domaine public de production.

La préproduction locale utilise un **double d’authentification HS256**, pas Supabase Auth hébergé. Le double vérifie signature, émetteur, expiration et session ; ses mots de passe et clés aléatoires restent dans `../backups/einvoice-local-preprod-private.json`, hors Git. La passerelle écoute uniquement `127.0.0.1:55441`. Les identités et identifiants fiscaux sont fictifs. Le schéma et les fonctions SQL sont réels, mais le bootstrap explicite les colonnes historiques de comptabilité absentes des migrations du dépôt. Cette préproduction ne prouve ni SMTP, ni OAuth, ni configuration des cookies de production, ni transmission fiscale. Voir `local-preprod-contract.json` pour la reproduction et les opérations HTTP prises en charge.

Les hooks de cette seule passerelle permettent d’avancer la disponibilité d’une reprise et d’expirer puis restaurer les dates exactes de l’essai fictif. Ils ne sont pas des endpoints applicatifs et ne sont pas déployés. Le changement d’état est une fixture ; les actions Next, contrôles SQL et téléchargements qui suivent sont exécutés réellement.

La révision SQL102 utilisée par les dernières preuves locales porte le SHA256 `b652c64a8e1a4e349dcaa61bb9b886bf2cf155ab4c034a42e3074b12df9cb354`. La passerelle enregistre l’empreinte du texte effectivement exécuté au démarrage.

Ces preuves ne prétendent pas que la migration102 soit déjà installée en production et ne dispensent pas d’une validation fonctionnelle et juridique avant activation officielle. Les vérifications de téléchargement, d’API et d’interface doivent rester rattachées à la version effectivement testée.
