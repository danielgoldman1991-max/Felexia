# Revue indépendante 108 — conflit métier HTTP 409

Verdict local favorable sur la migration 108 de SHA-256 `fff32be4330788ac806f128bd25eb5a329ec0d9a8967dc62789d9eee6c167df6`. **Aucune application hébergée dans cette revue.** Les originaux 105–107 et les données métier n'ont pas été modifiés par le reviewer.

## Contrôle du changement

La migration vise deux signatures exactes et trois fragments `RAISE` connus : version d'un document, taux référencé devenu différent et version d'une période de paie. Elle remplace seulement le SQLSTATE 40001 par PT409. Les corps complets sont contrôlés par empreintes après normalisation CRLF/LF et espaces externes ; un corps inattendu est refusé. Un état partiellement patché reste admissible seulement s'il correspond aux fragments et empreintes prévus.

Le contrôle `to_jsonb(pg_proc)-'prosrc'` est réaliste dans le moteur testé : il compare les colonnes réelles du catalogue, dont OID, owner, signature, ACL, langage, definer et proconfig. Les attributs système MVCC tels que `xmin` ou `ctid` ne font pas partie de ce rowtype. Le `CREATE OR REPLACE` exécuté pendant les tests conserve exactement toutes les colonnes hors corps, puis le corps final doit porter l'empreinte attendue. La comparaison ne repose donc pas uniquement sur le texte de `pg_get_functiondef`.

## Résultats frais

- **146 contrôles réussis en configuration stricte**, et146 en configuration historique assouplie. Ces comptes reprennent la suite109 métiers et les scénarios108 de l'agent PRO ; ils ne sont pas additionnables à ses comptes comme autant de contrôles indépendants uniques.
- Vraies migrations097/099/104–108 dans une base PGlite jetable, Auth et tables comptables historiques minimales explicitement simulées.
- Privilèges par défaut EXECUTE volontairement larges versPUBLIC/anon/authenticated/service_role avant installation105. Les révocations attendues restent effectives après108.
- Un octroi EXECUTE supplémentaire préexistant à un rôle de test est conservé sur les deux fonctions. Cela valide la conservation desACL, sans présenter ce rôle supplémentaire comme une nouvelle permission de production.
- `SECURITY INVOKER`, octroi service_role ou proconfig additionnelle sur une fonction pourtant de corps canonique :108 refuse chaque cas et sa transaction conserve l'état antérieur.
- Seconde fonction à fragment manquant ou corps modifié : refus et annulation du changement déjà effectué sur la première, sans écraser la seconde fonction inattendue.
- Patch partiel connu, application complète puis réapplication : résultat exact et idempotent. La fonction de conversion reste identique.
- Organisation témoin et compte bancaire de17MAD restent identiques lors des refus et succès. Les conflits métiers testés produisent réellement `PT409` dans le moteurSQL.

Preuves : `review-108-strict.json`, `review-108-relaxed.json`, runner `review-108.mjs`.

## Limite de remise en service

Ces tests établissent le changementSQL et sa sécurité transactionnelle, pas le retourHTTP du fournisseur hébergé. PostgREST documente les SQLSTATE40* commeHTTP500 et les codes `PTxyz` pour sélectionnerHTTPxyz, dont409 pour ce conflit. [Documentation primaire](https://docs.postgrest.org/en/v14/references/errors.html#raise-errors-with-http-status-codes).

Après application manuelle108, il faut rejouer la frontière publiqueSDK qui avait répondu504 et vérifier409/PT409, le motif affiché et les données conservées, puis terminer conversion/commande fournisseur/rôles/préparation de paie. La cause précise de l'ancien504 intermédiaire reste inconnue ; aucune relance automatique desPOST n'est imputée auSDK.
