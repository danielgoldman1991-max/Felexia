# Rapport final — facturation électronique préparatoire

Vérification du 31 octobre 2026, sur Node22.23.4 / Next16.4.3. Branche `codex/e-invoicing-maroc-20261031`. Migration102 vérifiée : `b652c64a8e1a4e349dcaa61bb9b886bf2cf155ab4c034a42e3074b12df9cb354`.

**Résultat : les parties indépendantes de la DGI sont implémentées et passent la recette locale. Aucun déploiement ni application de102 en production.** L’étape suivante reste la préproduction hébergée avec le vrai Supabase, puis l’autorisation de publication et l’activation pilote.

## État des livrables

| Classe | Résultat |
|---|---|
| **IMPLÉMENTÉ** | Factures/avoirs clients sortants, décimaux exacts, UBL2.1 générique, XSD réel, canonicalisation, PDF réel FR/AR, versions, émission figée, téléchargement protégé, RLS/rôles/abonnement, audit, file persistante, diagnostics, alertes internes et veille avec revue humaine. |
| **TESTÉ** | Domaine et calculs ; PostgreSQL isolé ; concurrence native ; restauration locale ; formulaires/actions du vrai Next avec SDK ; téléchargements et empreintes ; build optimisé ; navigateur et rendu PDF. |
| **SIMULÉ** | Résultats de transmission acceptée/rejetée/panne ; toutes les identités commerciales de recette ; façade Auth/PostgREST locale. Les règles SQL, le serveur Next et les moteurs XML/PDF ne sont pas simulés dans ces essais intégrés. |
| **EN ATTENTE DGI** | Profil marocain officiel machine, transport/API/identifiants/habilitation, environnement officiel d’essai, accusés et rapprochement officiels. Le mode officiel reste refusé. |
| **NON VÉRIFIÉ** | Supabase Auth hébergé pour ce nouveau module, déploiement Vercel de cette branche, sauvegarde/restauration cloud, formalités CNDP et transferts, revue juridique/fiscale exhaustive, prestataire/certificats de signature et archivage légal certifié. |

L’[index des livrables](README.md) relie les14 éléments demandés. Le standard UBL est un format préparatoire ; ni la validation XSD, ni SHA256, ni un reçu interne ne prouvent une conformité ou une connexion fiscale.

## Tests réellement exécutés

Les nombres suivants sont des assertions par suite. Les répétitions sous plusieurs moteurs ne représentent pas autant de fonctionnalités différentes ; aucun total artificiel n’est utilisé pour remplacer le périmètre des preuves.

| Suite | Résultat | Preuve |
|---|---|---|
| Domaine : factures/avoirs, remises, TVA multiple, zéro explicite, caractères FR/AR, XML/XSD/C14N, bornes/XXE et connecteur | **55/55**, zéro requête réseau observée | [domain-tests.json](../../training/e-invoicing/20261031/domain-tests.json) |
| Comparaison du calcul décimal avec PostgreSQL numeric | **405 cas, 3 645 valeurs identiques** | [decimal-postgres-parity.json](../../training/e-invoicing/20261031/decimal-postgres-parity.json) |
| Contrats SQL : RLS, tenants, grants, rôles, abonnement, versions, gel des sources, pièces et règlements | **135/135** sous PGlite strict, **135/135** relâché et **135/135** PostgreSQL natif | [strict](../../training/e-invoicing/20261031/database-strict.json), [relâché](../../training/e-invoicing/20261031/database-relaxed.json), [natif](../../training/e-invoicing/20261031/database-native.json) |
| Courses réellement simultanées sous PostgreSQL natif | **30/30** | [database-concurrency.json](../../training/e-invoicing/20261031/database-concurrency.json) |
| Dump puis restauration isolée : lignes, politiques, archives binaires et hashes | **11/11**, 89 tables et493 politiques comparées | [database-restore.json](../../training/e-invoicing/20261031/database-restore.json) |
| Adaptateur local et vrais SDK : JWT signé local, rôles SQL, transport bytea, RPC service, refus public | **50/50**, 44 requêtes loopback | [local-gateway-probes.json](../../training/e-invoicing/20261031/local-gateway-probes.json) |
| Parcours complet depuis une base locale neuve, avec vrais POST multipart Next | **94/94**, 94 requêtes | [next-flow.json](../../training/e-invoicing/20261031/next-flow.json) |
| Permissions et origine des actions Next | **10/10**, 19 requêtes | [next-permissions.json](../../training/e-invoicing/20261031/next-permissions.json) |
| Build optimisé réellement démarré sur localhost:3103 | **35/35**, 39 requêtes | [next-production-build.json](../../training/e-invoicing/20261031/next-production-build.json) |
| Composants/pages SSR réels, avec services et identité contrôlés | **43/43** | [ui-fixtures.json](../../training/e-invoicing/20261031/ui-fixtures.json) |
| Adaptateurs exacts, références, archives corrompues, fetch officiel borné, préparation devenue périmée | **29/29** | [server-guards.json](../../training/e-invoicing/20261031/server-guards.json) |
| Polices/XSD/WASM réellement présents dans les traces du build | **96/96** | [build-tracing.json](../../training/e-invoicing/20261031/build-tracing.json) |
| PDF : structure, extraction, géométrie, Unicode, métadonnées et concordance XML | **230/230** sur4 vrais PDF | [extraction.json](../../training/e-invoicing/20261031/pdf-qa/extraction.json) |
| Inspection visuelle des PDF rendus avec Poppler | **6/6 critères**, 15 pages inspectées | [visual-review.json](../../training/e-invoicing/20261031/pdf-qa/visual-review.json) |

Les fixtures SQL utilisent volontairement des fichiers de frontière factices pour éprouver les transactions ; elles ne prétendent pas valider un rendu. Les suites domaine, PDF et Next exécutent les vrais générateurs et la validation XSD, séparément.

## Parcours de la société fictive

La préproduction contient une entreprise synthétique et ses trois profils : administrateur, opérateur et lecteur. Un quatrième compte appartient à une autre entreprise pour les refus croisés. Il ne s’agit pas d’une nouvelle création de compte client réel ni d’un test de délivrabilité email.

1. L’administrateur active le mode explicitement interne. La préférence arabe est enregistrée, appliquée sans paramètre de langue sur les quatre écrans et consultable par le lecteur ; un choix français explicite la remplace. Le changement de langue ne change pas l’empreinte fiscale.
2. L’opérateur prépare une facture validée de **388,00 MAD**, avec remise et trois taux dont un taux nul à motif explicite. Une métadonnée non autorisée est refusée sans produire d’archive. Le renvoi de la même demande est idempotent.
3. Des versions FR/AR sont archivées. Le lecteur télécharge les deux formats des deux versions ; les hashes reçus sont identiques aux octets stockés en PostgreSQL. Le worker relit également les octets XML/PDF avant simulation.
4. L’opérateur valide, émet et marque la pièce prête. Une action de mutation forgée par le lecteur est refusée. L’impression commerciale renvoie la version PDF figée. Le contrôle réel d’intégrité passe.
5. L’administrateur simule une acceptation sur la facture ; un avoir lié de **54,00 MAD** suit le même cycle, puis un rejet avec alerte interne. Un scénario timeout est repris jusqu’à la limite de trois tentatives et reste explicitement inconnu/échoué, sans faux succès.
6. L’expiration de l’essai interdit les nouvelles écritures ; les archives restent lisibles. Les dates d’essai fictives sont restaurées exactement. Les accès d’une autre entreprise, les versions étrangères et les actions d’origine externe sont refusés.
7. Aucun nouveau numéro commercial, règlement ni mouvement comptable n’est créé par ces opérations électroniques. La conservation des règlements et des avoirs après émission est aussi vérifiée par SQL natif.

Le détail de préparation périmée est couvert par l’exécution du vrai service avec frontières de lecture contrôlées, et par SQL lors de l’émission. Il n’a pas été ajouté comme étape indépendante au dernier parcours HTTP94 ; cette distinction est conservée.

## Corrections issues des essais

- Redirection de l’impression vers l’archive **avant** de relire le détail vivant, afin de ne pas dépendre de coordonnées ou jointures courantes après émission.
- Noms des contrôles d’intégrité adaptés à la protection du journal contre les contenus XML/PDF/instantané, puis contrôle rejoué avec succès.
- Lecture et rehash des **octets archivés** par le worker, pas seulement comparaison des métadonnées.
- Émission refusée si les faits ou les paramètres fiscaux ont changé ; l’interface explique qu’une nouvelle préparation est nécessaire.
- Auteur désactivé, supprimé ou rétrogradé : tâche clôturée/auditée sous service et nouvelle soumission possible par un administrateur autorisé. L’expiration d’abonnement reste une pause jusqu’au renouvellement.
- Sélection des entreprises éligibles au cron avant sa limite : trente entreprises exclues ne peuvent plus masquer un pilote autorisé.
- Libellés des tâches et avoirs affectés, langue préférée, état de revue réglementaire, identification émetteur/client dans les erreurs et heures des reprises corrigés.
- PDF arabe : traitement bidirectionnel, glyphes liés et mappage Unicode corrigés. Les trois documents courts tiennent chacun sur **une page** ; l’exemple de68 lignes longues et15 paragraphes tient sur12 pages, sans perte de ligne ni de montant.
- Les coordonnées ou lignes qui dépassent physiquement une page sont refusées au lieu d’être tronquées ; deux cas de débordement sont exécutés dans la suite PDF. Le rendu est borné à100 pages et2MiB. Après ajout de ces garde-fous, les quatre PDF régénérés restent identiques octet par octet à ceux inspectés visuellement.

## Non-régression et qualité de publication

Build de production terminé, typage et lint de `src` et des scripts de ce module sans erreur. Audit npm des dépendances de production : **zéro vulnérabilité** au moment du contrôle. Les dépréciations Node émises par les outils de build ne bloquent pas la compilation.

Les suites existantes de régression métier, du lancement léger (**23 parcours, 21 écrans masqués, 6 menus**) et des sorties documentaires (**10 fixtures**) ont été réexécutées avec succès. Aucun nouvel étage de menu principal ni modification des RPC financiers historiques n’a été introduit.

Le build embarque les15 XSD officiels épinglés, leur manifeste, les2 polices et le moteur WASM inclus dans `libxml2raw.mjs`. Les routes du build optimisé ont réellement vérifié et servi les archives localement. Cela ne constitue pas un déploiement Vercel testé.

Revue navigateur : français bureau1440×1000 et arabe mobile390×844, RTL, navigation, bannières explicites et tableau à défilement propre. Aucun débordement horizontal global observé sur mobile ; le menu est fermé pour examiner le contenu. [Preuve](../../training/e-invoicing/20261031/browser-qa/review.json).

## Reproduction et limites d’exploitation

`npm ci`, puis `npm run test:e-invoicing`, les commandes PostgreSQL de [OPERATIONS.md](OPERATIONS.md), et `npm run build` suivi de `node training/e-invoicing/20261031/verify-tracing.mjs`. Les bibliothèques de test PostgreSQL sont installées dans un répertoire isolé explicite ; les scripts refusent une cible distante.

Pour Next isolé, créer la passerelle avec `--local-only --pglite-root=<paquet-isolé>`, puis lancer Node22 sur `training/e-invoicing/20261031/run-local-next.mjs dev`. Le manifeste privé généré hors dépôt neutralise Supabase réel, Stripe et cron. Le parcours complet exige une base neuve : `node training/e-invoicing/20261031/verify-next-flow.cjs`. Après build, lancer `run-local-next.mjs start`, puis `verify-next-flow.cjs --smoke-build --app-url=http://localhost:3103`. Aucun mot de passe ou token ne doit être copié dans les rapports.

Le cron électronique est préparé mais **non planifié** dans `vercel.json`. La simulation est lancée depuis les actions, puis reprise manuellement depuis la supervision. L’exploitant devra autoriser et configurer le planning pour obtenir une reprise automatique hébergée. Les alertes restent internes à l’application ; aucun email ni document fiscal n’a été envoyé pendant cette recette.

Les sauvegardes restaurées ici sont locales et synthétiques ; les archives ne sont pas présentées comme WORM, PDF/A ou archivage légal certifié. La checklist de [mise en production](RELEASE-CHECKLIST.md) reste à remplir avec les preuves hébergées et l’autorisation explicite.
