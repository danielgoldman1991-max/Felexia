# Publication du module documentaire

L’utilisateur a autorisé la publication par « envoi sur le site », après la recette du commit `86c7e48`. Projet vérifié : `felexia`, identifiant `prj_3VWRIDk122M2EssODvf3tZWXGRnQ`, domaine `https://www.felexia.pro`. Le code publié doit être reconstruit par Vercel depuis Git ; le build local et les passerelles de test ne sont pas envoyés.

## Prépublication

- Ancienne production : `c74c2f2`, déploiement `dpl_SqRbcX3LW9jJjK886ht4uYeBH5Hj`.
- La prévisualisation Vercel de `86c7e48` est `READY` : `dpl_Gp9jDW33d6HxWvbFkMRH1FjF2Nyi`. Son accès est protégé et n’a pas été présenté comme une recette HTTP hébergée réussie.
- Le contrôle [Supabase en lecture seule](../../training/e-invoicing/20261031/production-preflight.json) trouve les huit tables102 vides. La capacité103 attendue manque dans le cache de la session QA authentifiée : `404/PGRST202`. Le rôle service n’a pas servi à conclure à cette absence.
- Une reproduction isolée des privilèges par défaut Supabase a révélé un grant explicite `service_role` à retirer de la nouvelle émission atomique. Le correctif retire ce grant sans modifier les droits des membres authentifiés. **129 contrôles SQL** (43×3) et **5 contrôles d’installation/rollback** passent sur le SQL final.
- SQL103 SHA256 : `f82118ea8aaf2b6cf49f94906c1884d2d4ad3ae37d0b7e45ae8f252076ae59b8`.
- Installateur102–103 SHA256 : `3f589eac13719793dafb5352a287ca71ee6fdad6a2973ff03dec5b105abe7c30` (octets LF du dépôt).
- Les variables Production réservent initialement le déploiement à l’entreprise QA existante : global `false`, liste `1eabead7-02ca-4d44-b147-2831d8799eaa`. Cette entreprise dispose des trois profils et d’un essai Essentiel valide. Les autres entreprises ne sont pas activées automatiquement.

## Installation et activation

L’application manuelle de l’installateur final102–103 a été demandée à l’utilisateur conformément à sa préférence antérieure. Les deux indicateurs doivent être vrais. La publication du code ne prouve pas cette installation ni l’activation de l’entreprise. La configuration de celle-ci et le résultat authentifié `workflow_version=2,atomic_issuance=true` doivent ensuite être vérifiés avant d’annoncer le module actif en ligne.

La connexion officielle DGI et la signature qualifiée ne sont pas activées par cette publication. Le mode documentaire est `connector_mode=disabled` ; les PDF/XML et l’archivage fonctionnent sans transmission externe. Le cron électronique n’est pas ajouté à la planification du site.

Les preuves HTTP locales du commit86c7e48 restent celles de la [recette précédente](OPERATIONS-UPDATE.md). Elles ne constituent pas une preuve d’installation du SQL final ou d’exécution des nouveaux parcours sur le site public.
