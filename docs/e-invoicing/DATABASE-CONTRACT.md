# PostgreSQL102 — contrats applicatifs

Migration : `supabase/migrations/102_electronic_invoicing_maroc.sql`. Ce fichier décrit le contrat de développement, pas une migration appliquée en production.

Toutes les lignes portent `organization_id`. `source_kind` vaut `invoice` ou `credit_note` et référence les documents **clients sortants**. Aucun numéro, règlement ou journal comptable n'est créé par102.

## Capture et préparation

`einvoice_capture_source(p_source_kind text,p_source_id uuid) → jsonb` est accessible aux membres actifs, y compris lecteur et abonnement expiré. Retour :

```text
organization_id, source_kind, source_id, source_status, eligible, source_fingerprint,
configuration, configuration_fingerprint,
facts: {
 seller: {name,address,city,country,ice,if_number,rc,patente,cnss,phone,email},
 buyer: {id,name,address,city,postal_code,country,ice,if_number,rc,patente,cnss,phone,email},
 header: {id,number,date,due_date,currency,subtotal_ht,discount_total,tax_total,total_ttc,
          payment_terms,payment_method,notes,reason,
          original_invoice_id,original_invoice_number,original_invoice_date},
 lines: [{id,line_order,product_name,description,quantity,unit_price_ht,discount_rate,
          tax_rate,subtotal_ht,discount_amount,tax_amount,total_ttc,unit_id,unit_name}]
}
```

Tous les décimaux sont des chaînes. `source_fingerprint` est SHA256 de l'UTF8 de `facts::jsonb::text` PostgreSQL. Les statuts commerciaux, règlements, affectations, notes internes et timestamps n'en font pas partie. Ce hash **n'est pas** le hash du JSON canonique TypeScript.

L'éligibilité exige une source non archivée, des lignes et un TTC positif. Les statuts autorisés sont explicitement `validated/sent/partially_paid/paid/overdue` pour une facture et `validated/applied/partially_applied` pour un avoir. Un autre état n'est jamais implicitement admissible.

`configuration_fingerprint` est SHA256 de l'UTF8 de la configurationJSONB réduite aux clés présentes `buyer_type`, `require_seller_rc`, `default_unit_code`, `line_metadata`. Mode, langue et alertes n'invalident pas une préparation fiscale. La configuration est verrouillée et vérifiée à la préparation et à l'émission. Transmettre cette empreinte dans `p_validation.configuration_fingerprint` ; chaque version la conserve séparément de `source_fingerprint` et de `snapshot_sha256`.

```text
einvoice_save_preparation(
 p_actor uuid,p_source_kind text,p_source_id uuid,p_source_fingerprint text,
 p_snapshot jsonb,p_canonical_snapshot text,p_validation jsonb,p_artifacts jsonb,
 p_profile_version text,p_expected_version integer DEFAULT NULL,
 p_idempotency_key uuid DEFAULT NULL
) → jsonb                         SERVICE_ROLE UNIQUEMENT
```

L'acteur doit être un membre administrateur/opérateur avec droit de saisie. La source est verrouillée, son éligibilité et son empreinte sont revérifiées. La clé d'idempotence UUID est obligatoire. Si le document existe, `p_expected_version` doit correspondre à sa version courante. Une préparation d'un document brouillon ou validé mais jamais émis crée une **nouvelle version brouillon** ; aucune version ne remplace une archive émise.

Le snapshot est le DTO domaine camelCase, dont `organizationId`, `sourceId`, `sourceType`, `number`, `sourceTotals`. Le texte canonique doit se parser vers exactement ce snapshot. SHA256 du texte UTF8 est calculé enDB.

Validation : `{valid:boolean,issues:[],configuration_fingerprint:string,xsd:{valid:boolean,engine?,schema_sha256?,notRun?}}`. Une validation invalide accepte exactement zéro artefact et garde ses erreurs dans une version brouillon. Une validation valide exige XSD valide, un nom de moteur non vide, un `schema_sha256` hexadécimal de 64 caractères et exactement deux artefacts. Ces champs proviennent de l'exécution réelle du validateur serveur, jamais d'une saisie du navigateur.

Artefacts : `[{format:'xml'|'pdf',mime_type,content_base64,sha256,canonical_sha256?}]`. MIME XML `application/xml` ou `text/xml`, PDF `application/pdf`. Hashs exacts et tailles calculés enDB ; PDF4MiB maximum, XML2MiB maximum ; les documents XML avec déclaration DTD/ENTITY sont refusés. Les validations XSD réelles appartiennent au service serveur : aucune RPC publique ne permet de forger un résultat ou une archive.

Retour : `{document_id,version_id,version_number,current_version_number,status,snapshot_sha256,source_fingerprint,reused}`.

## États et paramètres

`einvoice_transition(p_document_id uuid,p_expected_version integer,p_target text) → jsonb` : administrateur/opérateur, abonnement actif. Cibles `validated`, `issued`, `ready_to_submit`, dans cet ordre. Une répétition du même état est idempotente. Validation et émission exigent la version courante valide avec XML+PDF. L'émission vérifie de nouveau les empreintes source et configuration fiscale. Les notes publiques et l'annulation/archivage de la source deviennent protégés ; les règlements continuent de fonctionner.

`einvoice_update_settings(p_organization_id uuid,p_enabled boolean,p_mode text,p_configuration jsonb DEFAULT '{}',p_expected_revision integer DEFAULT NULL) → jsonb` : administrateur uniquement. Pour une ligne existante, sa révision est obligatoire. `p_mode` ne peut valoir que `disabled` ou `simulation`. Configuration autorisée : `buyer_type`, `require_seller_rc`, `default_unit_code`, `language`, `line_metadata`, `alerts_enabled`. Aucune clé privée, cookie, jeton ou URL API n'est accepté.

## Simulation persistante

```text
einvoice_enqueue_simulation(p_document_id uuid,p_expected_version integer,
 p_scenario text,p_idempotency_key uuid) → {job_id,transmission_id,status,reused}
```

Administrateur uniquement ; document émis et prêt, mode simulation activé. Scénarios `accept`, `reject`, `timeout`, `unavailable`. Une clé ne peut pas changer de document/version/scénario ; une seule tâche en cours par version.

```text
einvoice_claim_jobs(p_worker text,p_limit integer DEFAULT10,
 p_organization_id uuid DEFAULT NULL,p_job_id uuid DEFAULT NULL) → jsonb[]
einvoice_finish_job(p_job_id uuid,p_lease_token uuid,p_outcome text,
 p_acknowledgement jsonb DEFAULT '{}',p_error_code text DEFAULT NULL) → jsonb
```

Ces deux RPC sont réservées au service serveur. En recette, toujours renseigner entreprise et tâche : aucun batch global n'est requis. Un claim retourne `job_id,organization_id,document_id,version_id,transmission_id,scenario,attempts,lease_token,lease_expires_at`. Lease2minutes, maximum3tentatives, reprise des leases expirées et délai30/60secondes après échec transitoire. Outcomes `accepted`, `rejected`, `timeout`, `unavailable`. Le mode est revérifié à la fin. Un ancien lease ne peut pas terminer une tentative nouvelle ; une répétition du même résultat est idempotente, un résultat différent avec le même lease est refusé.

Claim et finish prennent les verrous dans l'ordre **document puis tâche**. Un ancien administrateur supprimé, désactivé ou rétrogradé ne bloque pas définitivement sa version : le claim clôture sa tâche en `failed`, code `ACTOR_AUTHORIZATION_REVOKED`, transmission/document en `unknown`, et ajoute un événement `simulation.actor_authorization_revoked` avec `actor_id=NULL` et `original_actor_id` en métadonnée. Il n'exécute pas le traitement au nom de cet ancien membre. Un administrateur actuellement autorisé peut alors soumettre une nouvelle clé. L'abonnement expiré conserve au contraire une pause réversible : le renouvellement permet de reprendre la tâche existante.

```text
einvoice_due_organizations(p_organization_ids uuid[] DEFAULT NULL,
 p_limit integer DEFAULT 10) → [{organization_id:uuid}]
```

RPC service uniquement pour la découverte des lots. Limite de1à50. La liste facultative d'entreprises, les paramètres `enabled/simulation` et le dernier abonnement permettant la saisie sont filtrés **avant** groupement/tri/limite. `NULL` signifie un périmètre global explicite ; un tableau vide ne retourne aucune entreprise. Sont dues les tâches `queued/retry_wait` dont `available_at` est passée et `running` dont le lease est expiré, y compris une troisième tentative abandonnée. L'ancien rôle de l'acteur n'est pas filtré ici afin que claim puisse auditer et clôturer une tâche révoquée. Le cron applique la liste d'autorisation de déploiement à cet argument avant de demander le lot.

## Lecture des tables et archives

Tables lisibles en RLS par les membres actifs :

| Table | Colonnes utiles |
| --- | --- |
| `einvoice_settings` | `organization_id,enabled,connector_mode,configuration,revision,updated_by,created_at,updated_at` |
| `einvoice_documents` | `id,organization_id,source_kind,source_id,source_number,source_date,currency,status,simulation_status,official,current_version_id,current_version_number,issued_at,issued_by,created_by,created_at,updated_at` |
| `einvoice_versions` | `id,organization_id,document_id,version_number,source_fingerprint,configuration_fingerprint,snapshot,canonical_snapshot,snapshot_sha256,profile_version,previous_version_id,idempotency_key,request_hash,created_by,created_at` |
| `einvoice_artifacts` | `id,organization_id,document_id,version_id,format,mime_type,byte_length,sha256,canonical_sha256,signed,created_at` ; contenu `bytea` à charger viaRPC |
| `einvoice_validations` | `id,organization_id,document_id,version_id,valid,result,official_conformity,created_at` |
| `einvoice_transmissions` | `id,organization_id,document_id,version_id,scenario,idempotency_key,payload_hash,simulation,authority,status,acknowledgement,acknowledgement_sha256,error_code,created_by,created_at,updated_at` |
| `einvoice_jobs` | `id,organization_id,document_id,version_id,transmission_id,scenario,status,attempts,available_at,lease_expires_at,worker,error_code,created_by,created_at,updated_at,completed_at` ; ne pas exposer `lease_token` ou `finish_hash` dans la vue UI |
| `einvoice_events` | `id,organization_id,document_id,sequence,actor_id,event,severity,metadata,previous_hash,event_hash,created_at` |

Les états documentaires sont `draft/validated/issued/ready_to_submit`. Le champ **simulation_status**, séparé, vaut `not_submitted/queued/pending/transmitted/accepted/rejected/unknown`. Tâches : `queued/running/retry_wait/succeeded/failed`. Transmission : `queued/pending/transmitted/accepted/rejected/unknown`. `official=false`, `signed=false` et `simulation=true` sont imposés par contraintesSQL.

Vue `einvoice_source_index` : `id`TEXT stable `invoice:<uuid>`/`credit_note:<uuid>`, `organization_id,source_kind,source_id,number,issue_date,buyer_name,currency,total_ttc`TEXT,`source_status,archived_at`. Vue `security_invoker=true`, avec RLS des tables sources. Filtrer les archivés dans le service UI.

`einvoice_get_artifact(p_artifact_id uuid) → {id,document_id,version_id,format,mime_type,sha256,canonical_sha256,byte_length,content_base64}` : lecture authentifiée, y compris lecteur/abonnement expiré ; vérification du hash avant retour. Aucune génération au téléchargement.

## Journal serveur

`einvoice_audit_append(p_actor uuid,p_organization_id uuid,p_document_id uuid,p_event text,p_severity text DEFAULT 'info',p_metadata jsonb DEFAULT '{}') → uuid`, service uniquement. `document_id=NULL` est réservé aux événements admin de veille/sauvegarde. Métadonnées objet,64KiB maximum, sans XML/PDF complet ni secret. Événements hash-chaînés par entreprise ; ce mécanisme n'est pas une certification ni une signature qualifiée.

## Erreurs structurées

Préfixe `EINVOICE_*`. Principales : `AUTH_REQUIRED`, `ACCESS_DENIED`, `ADMIN_REQUIRED`, `WRITE_REQUIRED`, `SOURCE_NOT_AVAILABLE`, `SOURCE_NOT_VALIDATED`, `SOURCE_CHANGED`, `CONFIGURATION_CHANGED`, `CONFLICT`, `MODULE_DISABLED`, `ALREADY_ISSUED`, `CANONICAL_MISMATCH`, `SNAPSHOT_SOURCE_MISMATCH`, `ARTIFACT_HASH_MISMATCH`, `VALID_ARTIFACTS_REQUIRED`, `UNSAFE_XML`, `INVALID_PDF`, `SIMULATION_DISABLED`, `JOB_ALREADY_QUEUED`, `STALE_LEASE`, `IDEMPOTENCY_CONFLICT`, `IMMUTABLE_ARCHIVE`, `ISSUED_SOURCE_READ_ONLY`. L'abonnement réutilise `SUBSCRIPTION_WRITE_REQUIRED`.

Indicateur final de migration : `facturation_electronique_102_active`.

## Parcours opérationnel — migration103

```text
einvoice_get_capabilities(p_organization_id uuid) → jsonb
einvoice_issue_and_archive(p_document_id uuid,p_expected_version integer) → jsonb
```

Le premier RPC est une lecture authentifiée, limitée aux membres actifs de l’entreprise. Il retourne notamment `workflow_version=2` et `atomic_issuance=true`. Ces deux valeurs conditionnent l’activation du nouveau parcours côté serveur ; la présence des tables102 seule ne suffit pas. Les lecteurs et les abonnements expirés peuvent lire cette capacité et télécharger les archives, sans obtenir de droit d’écriture.

Le second vérifie et émet la version attendue dans une transaction, avec les mêmes contrôles de rôle, d’abonnement, d’activation, de source et de configuration que les opérations102. Une source ou une configuration modifiée annule aussi la validation intermédiaire et ses événements. Une émission déjà réalisée reste idempotente ; une version périmée est refusée. L’état de simulation reste séparé de l’émission documentaire. Aucun de ces RPC ne crée une transmission officielle ni une signature.

Les fonctions sont réservées au rôle `authenticated` ; l’accès direct `PUBLIC`, `anon` et `service_role` est révoqué. Indicateur complémentaire : `facturation_operations_103_active`, qui vérifie la présence des deux RPC. L’installateur `supabase/electronic-invoicing-102-103.sql` enveloppe les deux migrations dans une seule transaction. Voir [le rapport de correction](OPERATIONS-UPDATE.md).
