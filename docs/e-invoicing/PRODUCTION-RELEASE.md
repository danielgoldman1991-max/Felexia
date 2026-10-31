# Publication du module documentaire

L’utilisateur a autorisé la publication par « envoi sur le site », après la recette du commit `86c7e48`. La version est publiée et vérifiée sur [Felexia Pro](https://www.felexia.pro/facturation/electronique). Le code a été reconstruit par Vercel depuis Git ; aucun build local ni aucune passerelle de test n’a été envoyé.

| Élément | Résultat |
|---|---|
| Projet | `felexia` · `prj_3VWRIDk122M2EssODvf3tZWXGRnQ` |
| Cible et état | **Production · READY** |
| Code déployé | `b02c42b158021d3747009cc6654266fb9c45f639`, également sur `main` |
| Déploiement final | `dpl_wA2oqwzYL8cfcTAWraUns1iF8bL1` |
| URL du build | `https://felexia-1t3zxam76-danielgoldman1991-maxs-projects.vercel.app` |
| Domaines assignés | `www.felexia.pro` et `felexia.pro` |
| Framework et construction | Next.js ·22,252 secondes entre `buildingAt` et `ready` |
| CI | Deux exécutions Essentiel de `b02c42b` réussies, branche et `main` |

## Prépublication

- Ancienne production : `c74c2f2`, déploiement `dpl_SqRbcX3LW9jJjK886ht4uYeBH5Hj`.
- La prévisualisation Vercel de `86c7e48` est `READY` : `dpl_Gp9jDW33d6HxWvbFkMRH1FjF2Nyi`. Son accès est protégé et n’a pas été présenté comme une recette HTTP hébergée réussie.
- Le contrôle [Supabase en lecture seule](../../training/e-invoicing/20261031/production-preflight.json) trouve les huit tables102 vides. La capacité103 attendue manque dans le cache de la session QA authentifiée : `404/PGRST202`. Le rôle service n’a pas servi à conclure à cette absence.
- Une reproduction isolée des privilèges par défaut Supabase a révélé un grant explicite `service_role` à retirer de la nouvelle émission atomique. Le correctif retire ce grant sans modifier les droits des membres authentifiés. **129 contrôles SQL** (43×3) et **5 contrôles d’installation/rollback** passent sur le SQL final.
- SQL103 SHA256 : `f82118ea8aaf2b6cf49f94906c1884d2d4ad3ae37d0b7e45ae8f252076ae59b8`.
- Installateur102–103 SHA256 : `3f589eac13719793dafb5352a287ca71ee6fdad6a2973ff03dec5b105abe7c30` (octets LF du dépôt).
- Les variables Production réservent initialement le déploiement à l’entreprise QA existante : global `false`, liste `1eabead7-02ca-4d44-b147-2831d8799eaa`. Cette entreprise dispose des trois profils et d’un essai Essentiel valide. Les autres entreprises ne sont pas activées automatiquement.

## Installation et activation

L’utilisateur a exécuté l’installateur final102–103 et confirmé les deux indicateurs vrais. La [vérification hébergée](../../training/e-invoicing/20261031/production-migration-check.json) retourne ensuite `workflow_version=2,atomic_issuance=true` avec la session réelle de l’administrateur QA ; les appels anonymes et non membres sont refusés. Les métadonnées API confirment le contrat installé, sans certifier l’empreinte du texte SQL stocké côté base.

La recette pilote s’est exécutée sur le premier déploiement de production `dpl_3TKFJLaNEXzeSPKdd5jvxAZs91pZ`, avec le code `b02c42b`. Après sa réussite, `FELEXIA_EINVOICING_ENABLED=true` a été enregistré pour Production et le même code a été reconstruit dans le déploiement final ci-dessus. Les entreprises restent désactivées individuellement tant que leur administrateur n’a pas validé **Configuration → Activer le module**. Il n’y a pas eu d’activation en masse des réglages d’entreprise.

Une ancienne session du navigateur appartenait à la société QA13:11 (`c7728100-6e58-46b6-aa07-220b262169ab`), distincte du pilote autorisé. Le refus d’activation observé avant disponibilité globale correspondait à cette restriction de déploiement, et non à un défaut du RPC. La recette active a utilisé le bon administrateur QA21:12.

## Recette réellement exécutée sur le site

- L’administrateur a complété uniquement l’identité de l’entreprise fictive et de son client de recette : ICE tout à zéro, IF synthétique, adresse explicitement fictive. Aucun identifiant réel n’a été inventé ou modifié pour une société cliente.
- Activation depuis le formulaire public connecté, mode **Documents et archivage**, unité habituelle `C62`.
- Génération depuis la facture QA `FAC-2610-00001`, source `51279ec6-c2e1-4331-8b29-b496448bcbb6`, total240MAD ; version `be7ecb77-8909-4c47-bae8-d7a3fdbebd6e` conservée.
- PDF de9754octets téléchargé depuis le site et contrôlé visuellement après rendu Poppler : une page A4 lisible, montants200HT/40TVA/240TTC. L’aperçu PDF intégré du navigateur d’automatisation ne rendait pas la page ; le fichier téléchargé est valide et son rendu indépendant est vérifié.
- Émission et archivage depuis l’interface réelle : événements de validation et d’émission à la même seconde, statut **Émise et archivée**, mêmes fichiers et même version figés.
- [46 contrôles HTTP avec trois sessions réelles](../../training/e-invoicing/20261031/production-http-readonly.json) passent pour l’activation et les droits admin/opérateur/lecteur.
- [208 contrôles après émission](../../training/e-invoicing/20261031/production-issued-http.json) passent : interfaces français/arabe, téléchargements PDF/XML et empreintes SQL, téléchargement lecteur, aperçu inline, ancienne impression servie depuis l’archive, isolation d’entreprise et absence de formulaires de mutation pour le lecteur. Changer la langue d’interface conserve le PDF français déjà émis ; la preuve distincte de génération PDF arabe reste celle de la recette locale.
- [28 contrôles sur le déploiement final](../../training/e-invoicing/20261031/production-http-final-smoke.json) passent : l’ancienne entreprise QA hors liste pilote peut désormais accéder au formulaire d’activation administrateur et reste désactivée avant/après ce contrôle ; le lecteur du pilote retrouve la même archive émise et les fichiers restent identiques. Douze requêtes, aucune action de mutation.
- Les contrôles financiers retrouvent banque24MAD, caisse0, onze écritures équilibrées débit/crédit1229MAD, encaissements240MAD et décaissements216MAD. La première facture était déjà payée avant la publication. Une attente initiale du script la confondait avec la seconde facture ouverte ; la comparaison a été corrigée à partir du rapport historique, sans changer les données.

Les scripts HTTP de contrôle sont en lecture seule après leurs connexions Auth autorisées. Les opérations d’activation, de génération et d’émission ci-dessus ont été effectuées séparément dans l’interface, uniquement dans l’entreprise fictive. Aucun nouveau règlement, paiement, journal comptable, email ou envoi fiscal n’a été exécuté. Aucun job ni transmission électronique n’a été créé.

Preuves visuelles : [facture émise sur le site](../../training/e-invoicing/20261031/production-browser/issued-fr.png), [rendu du PDF](../../training/e-invoicing/20261031/production-browser/qa-pdf-fr.png), [observations du navigateur](../../training/e-invoicing/20261031/production-browser/browser-check.json).

## Contrôles d’exploitation et limites

La [santé publique](../../training/e-invoicing/20261031/production-public-health.json) retourne200, base disponible. Sans session, le module redirige vers la connexion ; le cron électronique refuse401 sans secret. Les réponses privées testées ne sont pas placées dans un cache partagé. Les journaux internes Vercel n’étaient pas accessibles par l’API connectée (403 d’accès équipe) ; aucun bilan exhaustif de ces journaux n’est revendiqué. Aucune protection de déploiement n’a été retirée et aucun drain externe n’a été installé.

La connexion officielle DGI et la signature qualifiée ne sont pas activées par cette publication. Le mode documentaire est `connector_mode=disabled` ; les PDF/XML et l’archivage fonctionnent sans transmission externe. Le cron électronique n’est pas ajouté à la planification du site.

Les preuves HTTP locales du commit86c7e48 restent celles de la [recette précédente](OPERATIONS-UPDATE.md). Elles ne constituent pas une preuve d’installation du SQL final ou d’exécution des nouveaux parcours sur le site public.

## Retour arrière

Pour suspendre les nouvelles opérations, désactiver d’abord le réglage de chaque entreprise activée, puis retirer son autorisation de déploiement. Conserver les tables102–103, leurs protections et les archives. Une facture QA est maintenant émise : ne pas revenir au code antérieur au module qui imprimerait des coordonnées vivantes à la place de son archive figée. Le code documentaire `b02c42b` reste la référence compatible ; les étapes de retour arrière détaillées figurent dans la [checklist](RELEASE-CHECKLIST.md).
