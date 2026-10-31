# Facturation électronique Maroc — Felexia Pro

Le parcours documentaire est publié sur [Felexia Pro](https://www.felexia.pro/facturation/electronique) : génération PDF/XML, aperçu et téléchargement, puis émission et archivage atomiques. Le bandeau technique répété est retiré ; les connexions avancées restent dans la configuration. Les migrations102 et103 ont été appliquées par l’utilisateur puis vérifiées avec une session réelle. Chaque administrateur peut activer le module pour son entreprise. Voir [la publication et les contrôles hébergés](PRODUCTION-RELEASE.md), [la correction opérationnelle](OPERATIONS-UPDATE.md) et l’[installateur transactionnel](../../supabase/electronic-invoicing-102-103.sql).

Module initial développé sur `codex/e-invoicing-maroc-20261031`, à partir du socle `c74c2f2c1fe8625d56a39bd8bf010a1b257aec59`, puis simplifié sur `codex/e-invoicing-operational-20261031`. La publication du code `b02c42b` a ensuite été explicitement autorisée par l’utilisateur : « envoi sur le site ». Ce dossier seul n’autorise aucune autre publication ou modification de production.

## Livrables

| Livrable | Emplacement |
|---|---|
| Audit préalable, risques, architecture et sources | [AUDIT.md](AUDIT.md) |
| Technique : calculs, UBL, XSD, canonicalisation | [Domaine](../../training/e-invoicing/20261031/DOMAIN.md) |
| Contrat SQL, permissions et RPC | [DATABASE-CONTRACT.md](DATABASE-CONTRACT.md) |
| Guide utilisateur | [USER-GUIDE.md](USER-GUIDE.md) |
| Matrice réglementaire | [CONFORMITY.md](CONFORMITY.md) |
| Connecteur et signature future | [CONNECTOR.md](CONNECTOR.md) |
| Sécurité et limites | [SECURITY.md](SECURITY.md) |
| Exploitation, supervision, sauvegarde, migration et retour arrière | [OPERATIONS.md](OPERATIONS.md) |
| Résultats et limites de recette | [TEST-REPORT.md](TEST-REPORT.md) |
| Publication et recette hébergée actuelle | [PRODUCTION-RELEASE.md](PRODUCTION-RELEASE.md) |
| Fonctionnalités en attente et autorisation de publication | [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) |
| Migration additive | [102_electronic_invoicing_maroc.sql](../../supabase/migrations/102_electronic_invoicing_maroc.sql) |

## Architecture intégrée

`Facture/avoir client existant → génération PDF/XML contrôlée et versionnée → aperçu/téléchargement → validation et émission/archivage atomiques`.

Les contrôles avancés et les simulations internes sont facultatifs et séparés du parcours documentaire courant.

La vente, les règlements et la comptabilité restent gérés par leurs fonctions existantes. Ce module ne renumérote pas les pièces et ne génère aucune écriture comptable. Les montants traversent ses frontières sous forme de chaînes décimales et sont calculés avec des entiers. Les versions, artefacts et contrôles sont persistés dans une seule transaction serveur ; l’interface ne détient pas le privilège d’écrire ces archives directement.

Le tableau de bord se trouve dans **Ventes → Facturation électronique**. Les réglages et la supervision sont réservés à l’administrateur. Le module propose le français et l’arabe avec sens RTL ; cela ne traduit pas tout le shell historique de l’ERP.

## Activation progressive

Deux conditions : liste serveur `FELEXIA_EINVOICING_ORGANIZATION_IDS` contenant les UUID autorisés (ou activation globale explicite `FELEXIA_EINVOICING_ENABLED=true`) **et** activation par l’administrateur dans les réglages. Les valeurs par défaut sont désactivées. Une coupure du flag arrête les nouvelles opérations ; la lecture des archives existantes reste possible selon l’appartenance à l’entreprise.

Le mode `official` est refusé côté serveur et en base. Le module ne reçoit aucune clé privée et n’appelle aucune API DGI. **Un XML valide pour le schéma UBL générique, un hash et une acceptation simulée ne constituent aucune certification, signature qualifiée ni acceptation fiscale.**

## Développement local isolé

Pour la version opérationnelle actuelle, suivre [operations-contract.json](../../training/e-invoicing/20261031/operations-contract.json) : passerelle55442, manifeste `einvoice-operations-local-private.json`, développement3104 et build local3103. L’ancien laboratoire55441 est conservé pour la version initiale102 et ne contient pas103.

Node22 est la version supportée. Installer les dépendances avec `npm ci`, puis utiliser les commandes de tests du rapport. La préproduction locale utilise le vrai serveur Next, les SDK Supabase et une base PostgreSQL isolée ; sa façade Auth/PostgREST est un double de test explicite. Voir [son contrat](../../training/e-invoicing/20261031/local-preprod-contract.json). Elle ne démontre pas la délivrabilité email, OAuth ou le déploiement hébergé.

Les variables locales de cette préproduction sont générées dans un fichier privé **hors dépôt**. Ne pas utiliser `.env.local` réel pour lancer la recette : son compte Supabase et ses clés de paiement concernent la production. Les scripts de passerelle bornent leurs destinations au loopback et neutralisent Stripe/cron dans le manifeste de lancement.
