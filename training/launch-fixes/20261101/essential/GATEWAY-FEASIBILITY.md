# Faisabilité de la recette Next → RPC → SQL

La passerelle historique `training/e-invoicing/20261031/local-gateway.mjs` n'est pas réutilisable directement pour le lot105–107 sans extension significative :

- Ports autorisés uniquement55441/55442 et noms de manifests exacts imposés ; les fichiers/ports historiques ont été préservés.
- Bootstrap allant jusqu'à102/103, jeu d'utilisateurs ESSENTIEL et données d'e-facture ; pas de chargement104–107 ni de fixture complète paie PRO.
- RPC autorisés uniquement `einvoice_*` et `get_commercial_document_usage` ; nouveaux RPC commerciaux, paie et compte préféré non routés.
- Allowlist REST sans les tables `sales_documents`, `purchase_documents`, `treasury_accounts` et RH nécessaires à ces parcours ; POST/PATCH métier générique non implémenté.
- Hooks limités aux reprises e-facture et à l'échéance ; aucune panne105/106/107 après la première écriture.
- Les anciennes suites HTTP vérifient des formulaires/routes d'e-facture et des origines Next3102/3103/3104 imposées, pas les nouveaux formulaires commerciaux/RH/trésorerie.

Créer55443 exigerait adapter bootstrap, transport, manifests, projections et scripts de navigation. Cela formerait une nouvelle simulation partielle de PostgREST à vérifier elle-même, en plus de la recette produit. Ce n'est pas un complément rapide fiable avant lancement.

Aucun serveur/gateway/Next/build démarré, aucun nouveau manifest d'authentification, aucun installateur de dépendance ni SQL cloud utilisé pour cette évaluation.

Solution retenue avec le coordinateur : préparer une intégration SQL jetable105–107 sur la même base, puis reprendre une vraie recette Next sur la société QA hébergée après application manuelle du bundle, si l'utilisateur l'applique. Les fixtures d'actions actuelles complètent cette preuve SQL et restent identifiées comme frontières synthétiques.
