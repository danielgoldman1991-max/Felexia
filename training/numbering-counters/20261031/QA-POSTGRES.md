# Contrôles PostgreSQL de la numérotation

## Résultat

La migration `097_document_numbering_controls.sql` passe **193 assertions** dans chacun des quatre environnements suivants :

| Moteur | Protections financières | Assertions | Résultat |
| --- | --- | ---: | --- |
| PostgreSQL 18.6 via PGlite | V3 strict | 193 | Réussi |
| PostgreSQL 18.6 via PGlite | V3 assoupli | 193 | Réussi |
| PostgreSQL 18.6 natif Windows | V3 strict | 193 | Réussi |
| PostgreSQL 18.6 natif Windows | V3 assoupli | 193 | Réussi |

Une seconde suite utilise **deux connexions PostgreSQL natives indépendantes authentifiées**, plus une connexion d’observation : ses **21 assertions de concurrence** passent aussi. Les attentes de verrou sont observées dans `pg_stat_activity`, et ne sont pas simulées par une file de requêtes dans un seul client.

Le SHA-256 canonique de la migration testée, après normalisation des fins de ligne, est `f0ff350d74c894ff9393c577a9075352df5dca614702cc609e361ce7c68e9fad`.

Le SHA-256 du fichier brut est `af7b100212d2df9ad469f3d3faeae1af7542b95894f0b9bbd780572b9fb6d6b1`. Le fichier `counter-contract.json` contient le véritable retour JSON des dix-sept compteurs fictifs, pour vérifier également l’adaptateur TypeScript sans appel à la production.

## Couverture fonctionnelle

- Les quinze types de documents/contacts et deux journaux sont présents dans les aperçus.
- Les documents antérieurs à la migration, y compris annulés et archivés, imposent une borne minimale. Aucune correction ne renumérote les documents existants.
- Une correction sûre vers le bas, de 100 à 20 alors que le dernier numéro émis est 9, est consommée par le véritable déclencheur à la création suivante.
- Les créations réelles consomment le compteur configuré pour chaque type. Le prochain aperçu progresse ensuite d’une unité.
- Les corrections avec un ancien aperçu sont refusées, y compris après un aller-retour de valeur A → B → A dans une même transaction.
- Les numéros au-delà de 99 999 ne sont pas tronqués. Les anciens numéros comportant de nombreux zéros initiaux sont interprétés sans fausse saturation et leur texte original est conservé dans l’aperçu.
- Un compteur erroné au plafond de l’entier reste réparable si les numéros réellement émis sont plus bas.
- Les mois sont indépendants ; les journaux partagent leur compteur par année. Les autres entreprises conservent leurs propres compteurs.
- Le registre de numéros émis conserve les réservations après suppression ou modification d’un document. Le réemploi manuel du numéro d’un document supprimé est également refusé.
- Un ancien code prospect PR converti en client conserve sa famille de numérotation. Sa suppression ne libère pas le numéro PR ; l’Opérateur peut toujours modifier ce client sans changer son code.
- Les révisions d’un compteur non initialisé sont liées à l’entreprise, même lorsque le format et le prochain nombre seraient identiques dans deux entreprises.
- Anonyme, lecteur, opérateur, comptable non administrateur, administrateur désactivé et utilisateur sans adhésion ne peuvent pas administrer les compteurs. Un administrateur ne peut pas cibler une autre entreprise ou l’un de ses journaux.
- Même lorsque le rôle anonyme reçoit volontairement le droit SQL d’insertion pour éprouver la défense en profondeur, un sujet d’authentification absent provoque une erreur 42501 avant la recherche d’un numéro déjà émis : aucune différence d’erreur ne révèle l’existence d’un document. Le rôle authentifié sans identité est également refusé. Les imports effectués par le propriétaire SQL de confiance restent possibles.
- Les écritures directes sur les compteurs (insertion, remise à zéro, préfixe ou suppression) et l’appel direct à l’allocateur privé ne permettent pas de contourner l’API auditée.
- L’Opérateur conserve la création quotidienne des sept types autorisés, mais ne peut ni fournir un numéro manuel ni renuméroter un contact.
- Seules les corrections réussies laissent une trace d’audit, avec l’acteur authentifié et un motif.

## Concurrence native

La seconde suite vérifie les scénarios suivants sur un serveur PostgreSQL natif :

1. Deux créations simultanées sans ligne de compteur préexistante : une seule séquence est créée et les numéros 1 et 2 sont attribués.
2. Une correction attend la transaction d’une création en cours, puis refuse sa révision devenue obsolète.
3. Deux administrateurs corrigent le même aperçu : une seule correction est validée et auditée.
4. Une correction annulée ne modifie ni le prochain numéro ni l’audit ; la création qui attendait utilise la valeur précédente.
5. Un document dont l’insertion est annulée ne consomme pas un numéro définitivement ; la seconde transaction reprend correctement ce numéro.
6. Un autre type de document et une autre entreprise continuent de numéroter sans attendre le verrou du compteur occupé.

## Isolation des données de test

Les scripts ne lisent aucune configuration de projet, variable d’environnement Supabase, session navigateur ni donnée de production. Leurs utilisateurs, entreprises et documents sont entièrement fictifs.

La suite fonctionnelle charge les schémas historiques et les véritables déclencheurs des migrations 001/002/005/006/014/018/019/020/021/022/028/029/030, puis les protections 093/094/095/096 et V3. La création historique des tables comptables n’est pas présente dans le dépôt : un schéma minimal explicite, fidèle aux champs et contraintes utilisés par la numérotation, remplace uniquement cette absence. Les générateurs et les fonctions de sécurité ne sont pas simulés. La section de stock sans rapport de la migration 022 est omise, comme dans le précédent banc de tests Opérateur.

Les fixtures fonctionnelles sont insérées avant le corps de 097 dans une transaction extérieure puis entièrement annulées. Seules les lignes `BEGIN`/`COMMIT` du fichier sont retirées pour préserver cette transaction de test. Après le rollback, le fichier complet est exécuté deux fois sur la base vide afin de vérifier sa transaction réelle et son idempotence.

La concurrence nécessite des fixtures visibles entre sessions : elles sont validées uniquement dans la base locale jetable, puis supprimées explicitement. Le nettoyage et l’absence finale d’entreprises de test sont contrôlés. Les scripts natifs refusent les connexions distantes, les mots de passe et les noms de base ne commençant pas par `numbering_qa_`.

Le runtime Windows est la distribution autonome PostgreSQL 18.6-5 liée depuis [PostgreSQL pour Windows](https://www.postgresql.org/download/windows/) vers les [binaires officiels EDB](https://www.enterprisedb.com/download-postgresql-binaries). Il a été extrait dans un dossier temporaire, sans service système, et écoute exclusivement sur `127.0.0.1:55439`. SHA-256 de l’archive : `E2246BA91D22345BC3D017586C09EDE52D9DF180B1EEB480F050445F1CAD84E2`.

## Reproduire

Les dépendances de test restent hors des dépendances de production, dans un dossier temporaire contenant `@electric-sql/pglite` et `pg`.

```powershell
node scripts/verify-numbering-counters.mjs --pglite-root="$env:TEMP/felexia-invitation-postgres-tests"
node scripts/verify-numbering-counters.mjs --pglite-root="$env:TEMP/felexia-invitation-postgres-tests" --relaxed-v3
```

Pour PostgreSQL natif, créer une base locale vide dédiée pour chaque variante, puis exécuter :

```powershell
node scripts/verify-numbering-counters.mjs --postgres-url=postgresql://postgres@127.0.0.1:55439/numbering_qa_strict --pg-root="$env:TEMP/felexia-invitation-postgres-tests"
node scripts/verify-numbering-counters.mjs --postgres-url=postgresql://postgres@127.0.0.1:55439/numbering_qa_relaxed --pg-root="$env:TEMP/felexia-invitation-postgres-tests" --relaxed-v3
node scripts/verify-numbering-concurrency.mjs --postgres-url=postgresql://postgres@127.0.0.1:55439/numbering_qa_strict --pg-root="$env:TEMP/felexia-invitation-postgres-tests"
```

Les résultats détaillés sont conservés dans les rapports JSON voisins ; `counter-contract.json` fournit séparément le retour réel de l’API sur les fixtures. Lint ciblé des deux scripts et `git diff --check` réussis.

## Vérification du projet public après installation

Le 31/10/2026, l'utilisateur a appliqué 097 et confirmé `numerotation_097_active = true`. Une lecture authentifiée indépendante a validé 23/23 contrôles (rapport `live-rpc-verification.json`) : 20 compteurs au contrat attendu, accès viewer/anonyme/autre entreprise refusés, vente 240 MAD payée, achat 120 MAD payé, banque 120 MAD et cinq écritures équilibrées préservés.

Le navigateur connecté à l'entreprise fictive affiche les 12 compteurs du profil léger avec un seul titre et une seule barre globale. Le parcours de correction a enregistré le compteur factures clients 3 → 4 puis 4 → 3, chaque fois avec aperçu, motif et confirmation ; les deux lignes d'audit et leur acteur ont été relus via le RPC. Aucun document métier n'a été créé ou modifié. La valeur 1 est refusée lorsque le minimum est 2. Le filtre Contacts affiche deux compteurs ; le mois suivant affiche FAC-2611-00001. À 390 px, aucun débordement horizontal n'est observé. Le viewport a été restauré après le test. Build de production réussi après ces contrôles.
