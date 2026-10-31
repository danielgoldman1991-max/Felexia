# Exploitation de la facturation électronique préparatoire

Procédure du 31 octobre 2026. Les essais décrits ici utilisent des entreprises synthétiques dans des bases locales isolées. La migration 102 et cette évolution applicative ne sont pas déclarées appliquées en production. Leur publication et leur application restent soumises à l'autorisation explicite de l'utilisateur.

Le périmètre couvre les factures et avoirs **clients sortants**. Les factures fournisseurs, les numéros existants, les règlements et les écritures comptables restent dans leurs parcours habituels. Le XML UBL 2.1 est préparatoire et générique ; aucun acquittement de simulation ne prouve une transmission à la DGI. Le mode officiel et la signature qualifiée sont techniquement désactivés.

## Fichiers et prérequis

| Élément | Référence |
| --- | --- |
| Migration additive | `supabase/migrations/102_electronic_invoicing_maroc.sql` |
| SHA256 de la migration vérifiée | `b652c64a8e1a4e349dcaa61bb9b886bf2cf155ab4c034a42e3074b12df9cb354` |
| Contrats RPC et champs | `docs/e-invoicing/DATABASE-CONTRACT.md` |
| Audit préalable | `docs/e-invoicing/AUDIT.md` |
| Tests PostgreSQL | `training/e-invoicing/20261031/verify-database.mjs` |
| Courses PostgreSQL réelles | `training/e-invoicing/20261031/verify-concurrency.mjs` |
| Restauration locale | `training/e-invoicing/20261031/verify-archive-restore.mjs` |

La base doit disposer du schéma historique Felexia, des migrations 097 à 101, des rôles Supabase `anon`, `authenticated`, `service_role`, du schéma `app_private`, d'`auth.uid()` et du helper de membership actif. PostgreSQL 15 ou supérieur est requis pour la vue `security_invoker`. Les tests natifs ont été exécutés avec PostgreSQL 18.6 ; les tests PGlite utilisent son moteur PostgreSQL embarqué.

La migration n'importe aucun historique, ne renumérote aucune pièce et ne réécrit aucun montant. Elle crée huit tables `einvoice_*`, une vue de sources, des RPC et deux protections supplémentaires sur les sources émises. Les écritures REST directes sur les nouvelles tables sont révoquées, y compris pour `service_role` ; les opérations de service passent par les RPC dédiées. Les lectures sont limitées à l'entreprise par RLS ; les accès de service restent exclusivement côté serveur.

Les services XML/PDF nécessitent le runtime Node.js et les dépendances, schémas XSD et polices embarqués dans la version applicative correspondante. La clé de service Supabase et `CRON_SECRET` restent des secrets serveur. Aucun mot de passe, certificat privé ou identifiant DGI ne doit être ajouté à la configuration JSON du module.

## Sauvegarde avant application

1. Conserver la référence Git et le bundle de code antérieurs. Un bundle Git protège le code ; il ne sauvegarde ni PostgreSQL ni Supabase Auth.
2. Obtenir une sauvegarde cohérente de la base avec la procédure réellement disponible chez l'hébergeur. Documenter sa date, sa référence, les schémas inclus, les rôles/accès à reconstruire et le point de reprise. Ne pas qualifier une simple capture de tableau de bord de sauvegarde restaurable.
3. Restaurer une copie sur une cible isolée. Vérifier les documents, soldes, écritures, memberships et politiques RLS avant de considérer la procédure comme éprouvée.
4. Après activation, inclure les huit tables `einvoice_*` dans toute sauvegarde métier cohérente : les fichiers XML/PDF sont des colonnes `bytea` de `einvoice_artifacts`, et non des liens vers un bucket public. Les snapshots, validations, événements et transmissions font partie du même ensemble.

Le formulaire « contrôle de sauvegarde » du module consigne une **attestation humaine** dans `backup.attested` avec `human_attestation=true` et `automatically_verified=false`. Il ne réalise aucun dump, aucune restauration ni vérification de PITR.

La preuve locale `database-restore.json` atteste un véritable `pg_dump -Fc` suivi d'un `pg_restore --single-transaction` vers une autre base locale : 89 tables et 493 politiques RLS identiques, huit archives et quatre versions contrôlées, puis lecture sous les trois rôles et réapplication 102 sans perte. Les onze contrôles passent. Les artefacts de cette fixture sont volontairement des données de frontière SQL ; cette preuve ne valide ni le service de sauvegarde Supabase de production, ni une durée de conservation légale, ni un archivage WORM/certifié.

## Application et activation progressive

Avant toute application autorisée, vérifier la version du fichier et l'état du projet cible :

```sql
select current_setting('server_version') as postgres_version,
       current_setting('server_version_num')::integer >= 150000 as version_compatible,
       to_regclass('public.customer_invoices') is not null as factures_presentes,
       to_regclass('public.customer_credit_notes') is not null as avoirs_presents,
       to_regprocedure('app_private.has_active_org_membership(uuid)') is not null
         as helper_tenant_present;
```

Exécuter le fichier 102 complet dans une session de migration disposant des droits nécessaires. Il contient sa transaction et se termine par la colonne `facturation_electronique_102_active`, attendue à `true`. La réexécution du même fichier a été testée ; elle ne remplace pas une revue d'une version ultérieure différente. Le SQL Editor doit avoir terminé sans erreur avant de publier un résultat positif.

La création des triggers sur les factures/avoirs demande des verrous DDL sur ces tables. Appliquer pendant une fenêtre calme ; en cas de contention, annuler la session en attente et replanifier plutôt que supprimer les protections ou interrompre des transactions métier. Le fichier ne contient aucun `UPDATE` massif des pièces existantes.

Après application, vérifier aussi les droits sans lire les archives complètes :

```sql
select to_regprocedure('public.einvoice_capture_source(text,uuid)') is not null
         as capture_installee,
       not has_function_privilege(
         'authenticated',
         'public.einvoice_save_preparation(uuid,text,uuid,text,jsonb,text,jsonb,jsonb,text,integer,uuid)',
         'execute') as depot_serveur_uniquement,
       not has_table_privilege('authenticated','public.einvoice_artifacts','INSERT')
         as insertion_directe_interdite,
       not has_table_privilege('service_role','public.einvoice_artifacts','UPDATE')
         as modification_service_directe_interdite;
```

Publier ensuite la version applicative compatible avec les téléchargements d'archives. Le déploiement démarre avec `FELEXIA_EINVOICING_ENABLED=false` et sans entreprise autorisée. Pour une recette ciblée, renseigner uniquement l'UUID de l'entreprise de test dans `FELEXIA_EINVOICING_ORGANIZATION_IDS` ; le serveur accepte une liste séparée par des virgules. L'activation globale `FELEXIA_EINVOICING_ENABLED=true` n'est nécessaire qu'après validation du périmètre voulu.

Un administrateur active ensuite les paramètres de **son** entreprise dans `/facturation/electronique/configuration`. `enabled=true` autorise la préparation ; `connector_mode=disabled` ne lance aucune transmission et `simulation` autorise seulement les scénarios internes. Le parcours Next exige à la fois l'autorisation de déploiement, le paramètre de l'entreprise, un rôle autorisé et un abonnement permettant la saisie. PostgreSQL contrôle ses propres paramètres, rôles et abonnements ; il ne connaît pas les variables d'environnement Next. Un administrateur authentifié conserve notamment le droit de configurer son entreprise via la RPC dédiée. Lecteurs et abonnements expirés conservent la lecture et le téléchargement des archives déjà créées, même après retrait de l'autorisation de déploiement.

La recette ciblée doit couvrir une facture et un avoir, une préparation invalide puis corrigée, validation/émission, téléchargement XML/PDF, les trois rôles, les quatre scénarios et la reprise après erreur. Ne lancer aucun lot global pour une simple recette.

## Numéros, faits fiscaux et comptabilité

Les numéros proviennent des pièces commerciales existantes et de la migration 097. Le module ne crée pas de deuxième compteur. La préparation et la simulation ne créent aucune ligne comptable, mouvement bancaire ou règlement. La comptabilisation reste une opération explicite du parcours existant, protégée par l'unicité des sources comptables ; « émis » et « accepté en simulation » ne signifient jamais « comptabilisé ».

Les décimaux sont capturés en chaînes SQL exactes. Pour les ventes et avoirs clients, le HT stocké est déjà net de remise. Le moteur recalcule selon la politique versionnée sans déduire une remise deux fois. Les montants payés, restants et affectations ne figurent pas dans l'empreinte fiscale : le règlement ou l'affectation d'un avoir restent possibles après émission.

Une modification des faits de la source ou des paramètres fiscaux entre préparation et émission provoque un refus. Les clés fiscales concernées sont `buyer_type`, `require_seller_rc`, `default_unit_code` et `line_metadata`. Langue, mode de connexion et alertes n'invalident pas une préparation. Avant émission, régénérer crée une nouvelle version brouillon et conserve les précédentes ; après émission, il n'y a aucun retour vers un brouillon ni remplacement des archives. Les notes publiques, annulation, archivage et suppression de la source émise sont protégés. Une correction financière suit le parcours d'avoir adapté, pas une modification forcée du snapshot.

## Archives et téléchargement

L'espace utilisateur est `/facturation/electronique`. Les détails utilisent `/facturation/electronique/factures/<sourceId>` et `/facturation/electronique/avoirs/<sourceId>`. Les téléchargements utilisent le même chemin suivi de `/download?format=xml|pdf&version=<versionId>` ; `inline=1` affiche le PDF. Ils vérifient l'entreprise et l'empreinte, renvoient `Cache-Control: private, no-store` et ne régénèrent pas les documents à partir des paramètres actuels.

Chaque version conserve le snapshot canonique, les empreintes source et configuration, le résultat de validation et les archives binaires. Le hash binaire, le hash du JSON canonique TypeScript et le hash de la représentation JSONB fiscale PostgreSQL ont des fonctions distinctes. Ne pas comparer ces trois valeurs comme si elles représentaient les mêmes octets. Un hash et une chaîne d'événements ne constituent pas une signature qualifiée ni une preuve d'archivage certifié.

En cas d'erreur d'intégrité : conserver l'archive et les preuves, suspendre les nouvelles opérations sur le périmètre concerné, comparer avec la sauvegarde restaurée et diagnostiquer le stockage/service. Ne jamais écraser une archive pour lui faire correspondre un hash ou régénérer silencieusement un PDF émis.

## Traitements, reprise et supervision

La supervision administrateur est `/facturation/electronique/supervision`. Une simulation reçoit une clé d'idempotence liée au document, à la version et au scénario. Les scénarios `accept`, `reject`, `timeout`, `unavailable` restent explicitement marqués internes ; le stockage interdit `official=true`, `signed=true` et `simulation=false`.

Un worker détient un lease de deux minutes. Les échecs transitoires ont au maximum trois tentatives avec attentes de 30 puis 60 secondes. Un worker tardif ne peut plus terminer un lease remplacé. Une troisième tentative abandonnée est clôturée en échec avec `LEASE_ATTEMPTS_EXHAUSTED` et transmission `unknown` lors de la reprise suivante. Un rejet est terminal ; une expiration n'est jamais interprétée comme une acceptation.

La reprise manuelle admin traite un lot borné de dix tâches au maximum dans son entreprise. La route serveur `/api/cron/e-invoicing` est protégée par `CRON_SECRET`, sans cache, et borne également chaque invocation à dix traitements. Le `vercel.json` de cette version ne planifie pas encore cette route : son unique planning existant concerne les rappels d'essai. Toute planification électronique doit être configurée et testée explicitement après autorisation, avec le périmètre d'entreprises voulu. Ne pas appeler le cron de rappels pour traiter des factures. Les tests d'accès sans Bearer/avec Bearer invalide n'exécutent aucun lot.

Le traitement revérifie le rôle, l'abonnement, le mode, la version et les empreintes des archives. Si le mode ou les accès ont changé, les tâches restent visibles pour diagnostic ; ne pas les forcer à `accepted` par SQL. Les alertes sont internes à l'application et désactivables ; elles n'envoient pas d'email de facture.

Si l'administrateur à l'origine d'une tâche est supprimé, désactivé ou rétrogradé, le service la clôture en `failed/ACTOR_AUTHORIZATION_REVOKED`, conserve une transmission `unknown` et audite cette intervention avec un acteur de service nul, sans agir sous l'identité révoquée. Cela libère la version pour une nouvelle soumission par un administrateur autorisé. Une simple expiration d'abonnement est distincte : la tâche reste en pause et peut reprendre après renouvellement. La découverte des entreprises à traiter utilise `einvoice_due_organizations` : paramètres actifs, abonnement et liste d'autorisation sont filtrés avant la limite, pour éviter qu'une file ancienne d'entreprises désactivées ou hors périmètre ne bloque les entreprises admissibles.

Les événements techniques incluent codes d'erreur, version, durée, empreintes et contexte borné. Ne pas ajouter dans les logs XML/PDF complets, noms de clients, cookies, jetons ou clés. Les changements de pages officielles sont des signaux à examiner par un humain. La revue consignée ne modifie aucune règle fiscale automatiquement et ne constitue pas une validation réglementaire.

## Requêtes de diagnostic en lecture seule

Remplacer `:organization_id` par l'UUID de l'entreprise autorisée dans un client SQL paramétré. Les requêtes sont volontairement limitées à ce tenant. Les UUID, numéros et métadonnées retournés restent des données internes ; ne pas les recopier dans un rapport public sans nécessité.

```sql
-- File, tentatives abandonnées et erreurs ; aucun contenu documentaire.
select id, document_id, status, attempts, available_at, lease_expires_at,
       error_code, updated_at
from public.einvoice_jobs
where organization_id = :organization_id
  and (status in ('queued','retry_wait','failed')
       or (status = 'running' and lease_expires_at <= clock_timestamp()))
order by updated_at desc, id
limit 100;

-- Toute ligne retournée signale une incohérence binaire à investiguer.
select id, document_id, version_id, format
from public.einvoice_artifacts
where organization_id = :organization_id
  and (byte_length <> octet_length(content)
       or sha256 <> encode(sha256(content),'hex'));

-- Toute ligne retournée signale une incohérence du snapshot canonique.
select id, document_id, version_number
from public.einvoice_versions
where organization_id = :organization_id
  and (canonical_snapshot::jsonb <> snapshot
       or snapshot_sha256 <>
          encode(sha256(convert_to(canonical_snapshot,'UTF8')),'hex'));

-- Les archives valides doivent avoir les deux formats pour leur version.
select v.id, v.document_id, v.version_number, count(a.id) as formats
from public.einvoice_versions v
join public.einvoice_validations q
  on q.organization_id = v.organization_id and q.version_id = v.id and q.valid
left join public.einvoice_artifacts a
  on a.organization_id = v.organization_id and a.version_id = v.id
where v.organization_id = :organization_id
group by v.id, v.document_id, v.version_number
having count(a.id) <> 2;

-- Vérifier séparément les états électroniques et les retours simulés.
select status, simulation_status, official, count(*)
from public.einvoice_documents
where organization_id = :organization_id
group by status, simulation_status, official
order by status, simulation_status;

-- Diagnostic borné sans les métadonnées pouvant contenir des notes humaines.
select sequence, document_id, event, severity, created_at
from public.einvoice_events
where organization_id = :organization_id
order by sequence desc
limit 100;
```

Le hash-chaînage complet des événements est recomputé par les tests concurrents sur les champs réellement stockés. Une absence d'erreur dans les requêtes ci-dessus ne remplace ni ce contrôle, ni la validation XSD réelle, ni un test de restauration.

## Retour arrière et incident

Pour suspendre complètement les opérations d'une entreprise, commencer par désactiver **en base**, via `einvoice_update_settings` avec un administrateur autorisé et la révision courante, `enabled=false` et `connector_mode=disabled`. Conserver la configuration fiscale existante. Vérifier le résultat et l'absence de nouvelles écritures de traitement, puis retirer l'entreprise de l'autorisation de déploiement ou désactiver l'activation globale. Cet ordre permet encore d'utiliser l'interface d'administration avant son retrait du périmètre Next. Les tâches ne sont ni supprimées ni déclarées réussies ; elles restent inspectables.

Les flags d'environnement seuls bloquent les services Next, mais ne constituent pas un interrupteur PostgreSQL : ils ne sont pas lus par les RPC PostgREST. Les contrôles rôle/tenant/abonnement restent imposés en base et un administrateur conserve son droit explicite de reconfigurer le module. Un gel exigeant aussi le retrait de ce droit doit passer par une décision d'exploitation sur les accès concernés, pas par l'affirmation qu'un flag serveur suffit. Conserver les données, l'accès authentifié aux archives et les protections des sources émises.

Après la première émission, revenir à une application antérieure sans prise en charge des archives peut réintroduire une impression dynamique fondée sur l'identité courante. Privilégier une correction en avant ou un retour vers une version applicative compatible 102, avec préparation et simulation désactivées. Ne pas supprimer tables, versions, artefacts, événements, FKs ou triggers pour contourner un incident. Aucun script destructif de descente n'est fourni.

Si une restauration de données devient nécessaire, restaurer d'abord vers une cible isolée, vérifier cohérence métier/archives/RLS et quantifier les écritures postérieures au point de reprise. La restauration d'un tenant par copie partielle n'est pas présumée sûre : sources, règlements, comptabilité et archives sont liés. Toute bascule de production ou suppression exige une décision explicite et une procédure adaptée à l'hébergeur.

## Preuves et reproduction locale

Les rapports `database-strict.json`, `database-relaxed.json`, `database-native.json` contiennent chacun 135 assertions réussies ; `database-concurrency.json` contient 30 contrôles de courses ; `database-restore.json` contient onze contrôles de restauration. Total de ce lot PostgreSQL : **446 contrôles réussis**, avec leurs périmètres distincts. Les rapports consignent l'empreinte du fichier de migration utilisé.

Les scripts n'utilisent pas le fichier `.env` du projet. Le test natif exige une URL de boucle locale au port 55439, une base `numbering_qa_*` et un utilisateur sans mot de passe de production. Les tests de concurrence et restauration créent des bases synthétiques dédiées. Les commandes suivantes sont des commandes de laboratoire, avec chemins d'installation à adapter :

```powershell
node training/e-invoicing/20261031/verify-database.mjs --pglite-root=<racine-paquet-pglite>
node training/e-invoicing/20261031/verify-database.mjs --pglite-root=<racine-paquet-pglite> --relaxed-v3
node training/e-invoicing/20261031/verify-database.mjs --postgres-url=postgresql://postgres@127.0.0.1:55439/numbering_qa_einvoice_local --pg-root=<racine-paquet-pg>
node training/e-invoicing/20261031/verify-concurrency.mjs --postgres-url=postgresql://postgres@127.0.0.1:55439/numbering_qa_einvoice_local --pg-root=<racine-paquet-pg>
node training/e-invoicing/20261031/verify-archive-restore.mjs --postgres-url=postgresql://postgres@127.0.0.1:55439/numbering_qa_einvoice_local --pg-root=<racine-paquet-pg> --pg-bin=<binaires-postgresql>
```

Les fixtures SQL prouvent les contraintes et frontières de confiance : elles portent expressément un XML et un PDF factices, et un résultat XSD de frontière. Elles ne prouvent pas le rendu documentaire. La validation UBL réelle avec les XSD embarqués, le rendu PDF, l'application Next et le navigateur sont vérifiés séparément dans le rapport de tests global. De même, une passerelle Auth/REST locale simulée ne valide pas la configuration Supabase Auth ou les sauvegardes de production. Ces limites doivent rester visibles dans tout compte rendu de mise en service.
