# Facturation électronique Maroc — Felexia Pro

Module préparatoire développé sur `codex/e-invoicing-maroc-20261031`, à partir du socle `c74c2f2c1fe8625d56a39bd8bf010a1b257aec59`. **Aucun déploiement ni migration102 en production n’est autorisé par ce dossier.**

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
| Fonctionnalités en attente et autorisation de publication | [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) |
| Migration additive | [102_electronic_invoicing_maroc.sql](../../supabase/migrations/102_electronic_invoicing_maroc.sql) |

## Architecture intégrée

`Facture/avoir client existant → capture fiscale exacte → contrôles → instantané versionné → XML UBL + XSD + PDF → validation interne → émission figée → prêt → simulation interne facultative`.

La vente, les règlements et la comptabilité restent gérés par leurs fonctions existantes. Ce module ne renumérote pas les pièces et ne génère aucune écriture comptable. Les montants traversent ses frontières sous forme de chaînes décimales et sont calculés avec des entiers. Les versions, artefacts et contrôles sont persistés dans une seule transaction serveur ; l’interface ne détient pas le privilège d’écrire ces archives directement.

Le tableau de bord se trouve dans **Ventes → Facturation électronique**. Les réglages et la supervision sont réservés à l’administrateur. Le module propose le français et l’arabe avec sens RTL ; cela ne traduit pas tout le shell historique de l’ERP.

## Activation progressive

Deux conditions : liste serveur `FELEXIA_EINVOICING_ORGANIZATION_IDS` contenant les UUID autorisés (ou activation globale explicite `FELEXIA_EINVOICING_ENABLED=true`) **et** activation par l’administrateur dans les réglages. Les valeurs par défaut sont désactivées. Une coupure du flag arrête les nouvelles opérations ; la lecture des archives existantes reste possible selon l’appartenance à l’entreprise.

Le mode `official` est refusé côté serveur et en base. Le module ne reçoit aucune clé privée et n’appelle aucune API DGI. **Un XML valide pour le schéma UBL générique, un hash et une acceptation simulée ne constituent aucune certification, signature qualifiée ni acceptation fiscale.**

## Développement local isolé

Node22 est la version supportée. Installer les dépendances avec `npm ci`, puis utiliser les commandes de tests du rapport. La préproduction locale utilise le vrai serveur Next, les SDK Supabase et une base PostgreSQL isolée ; sa façade Auth/PostgREST est un double de test explicite. Voir [son contrat](../../training/e-invoicing/20261031/local-preprod-contract.json). Elle ne démontre pas la délivrabilité email, OAuth ou le déploiement hébergé.

Les variables locales de cette préproduction sont générées dans un fichier privé **hors dépôt**. Ne pas utiliser `.env.local` réel pour lancer la recette : son compte Supabase et ses clés de paiement concernent la production. Les scripts de passerelle bornent leurs destinations au loopback et neutralisent Stripe/cron dans le manifeste de lancement.
