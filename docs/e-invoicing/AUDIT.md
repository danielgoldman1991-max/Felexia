# Audit préalable - Facturation électronique Maroc

Audit du 31 octobre 2026, réalisé avant les modifications fonctionnelles. Base Git locale et GitHub : `c74c2f2c1fe8625d56a39bd8bf010a1b257aec59`. Le dépôt distant `danielgoldman1991-max/Felexia` a été relu avec `git fetch origin main`. Les trois audits indépendants couvrent données/sécurité, moteur documentaire et interface. Aucun document métier de production n'a été modifié.

## Architecture existante

- Next.js 16.4.3 App Router, React 19.2.4, TypeScript, Tailwind 4 ; runtime Node.js 22.
- Authentification Supabase Auth et cookies SSR ; PostgreSQL Supabase avec RLS ; fichiers existants dans Supabase Storage ; déploiement Vercel via GitHub.
- Offre publique Essentiel et navigation légère à six rubriques. Les modules avancés restent masqués. Les autorisations de navigation et d'abonnement sont indépendantes.
- Les guides Next installés ont été relus : Route Handlers, formulaires/actions serveur. Authentification et autorisation doivent être vérifiées dans chaque mutation, même derrière un layout protégé.

## Données et intégration comptable

Les factures/avoirs clients, lignes, clients, paiements, comptes et écritures existent. Les champs fiscaux sont répartis entre `company_settings`, `organizations` et `third_parties`. L'introspection du schéma PostgREST de production confirme ces contrats et les RPC 097/098/100 ; aucune ligne métier n'a été extraite pour cet audit. Aucun objet `einvoice_*` n'existe au départ.

Les migrations 098 et 100 fournissent sauvegardes atomiques, contrôles de tenant, immobilisation des faits financiers validés et intégration comptable. L'index des sources comptables actives évite une double comptabilisation. La migration 097 contrôle les numéros et leur correction par comparaison de version ; 099 protège l'abonnement.

Pour les ventes et avoirs clients, `subtotal_ht` est déjà net de remise. Le nouveau moteur ne doit pas soustraire `discount_total` une deuxième fois. Les quantités PostgreSQL ont trois décimales et les montants/prix/taux deux décimales. La politique actuelle est : brut arrondi, remise arrondie, net, TVA arrondie, puis sommes. Les services TypeScript existants convertissent toutefois les valeurs en `Number` : ils ne doivent pas alimenter le XML canonique.

Les règlements peuvent faire évoluer les soldes d'une pièce validée ; ces soldes ne sont pas des faits fiscaux immuables. Les nouveaux instantanés excluront `paid_amount`, `remaining_amount`, affectations et notes internes. Les anciens numéros seront réutilisés. Le module ne créera aucune écriture ni aucun paiement supplémentaire.

Le périmètre d'émission est celui des **factures et avoirs clients sortants**. Les factures fournisseurs sont reçues : elles ne seront pas réémises au nom de leur fournisseur. Leurs parcours actuels restent conservés ; un futur adaptateur de réception sera distinct.

## Lacunes documentaires constatées

| Élément | Existant | Conséquence |
| --- | --- | --- |
| PDF | HTML imprimable avec `window.print()` | Pas de fichier binaire historique figé. |
| Identité émetteur/client | Relue dans les paramètres courants | Un changement d'adresse peut changer une ancienne impression. |
| XML | Export TVA préparatoire propriétaire | Ce n'est ni une facture UBL ni une connexion DGI. |
| Fiscalité à 0 % | Taux sans catégorie/motif systématique | Ne pas déduire automatiquement une exonération. |
| Unités | Libellés libres et références locales | Définir un code technique explicite pour UBL. |
| Versions et archives | Aucun instantané, manifeste ou empreinte de facture électronique | Ajouter des versions et artefacts immuables. |
| Transmission | Aucun connecteur ni outbox | Prévoir des traitements persistants et idempotents. |
| Signature | Aucune signature qualifiée | Ne pas assimiler un hash ou un PDF à une signature. |

## Authentification, rôles et abonnement

L'entreprise active vient du membership authentifié, jamais d'un champ client. Les nouvelles routes doivent vérifier la même entreprise côté application et PostgreSQL. Les administrateurs gèrent les paramètres et la simulation ; les profils opérationnels autorisés préparent et émettent ; le lecteur consulte et télécharge les archives déjà créées. Un abonnement expiré garde la consultation et l'export, sans nouvelle préparation ni émission.

Les nouvelles tables doivent refuser les écritures REST directes. Les RPC auront `search_path` fixé, contrôle explicite du rôle/tenant/abonnement et droits minimaux. Les commits d'artefacts fournis par le serveur et les traitements de fond seront réservés au service serveur. Les clients ne pourront pas déposer un faux résultat XSD ou une fausse archive via un RPC public.

Les FKs composites entre nouvelles tables doivent inclure l'entreprise. Les versions, artefacts et événements d'un document émis ne doivent pas pouvoir disparaître par une suppression en cascade d'une source. Les journaux techniques doivent éviter noms, emails, secrets et XML complet.

## Interface et langues

Une seule entrée sous **Ventes** : « Facturation électronique ». Tableau de bord, liste, détail, versions et téléchargements sont réunis dans ce parcours. Configuration et supervision restent accessibles à l'administrateur depuis cet espace. Aucun septième grand menu ni nouveau plan commercial n'est nécessaire.

`ModulePage` contient déjà l'AppShell : ne pas l'imbriquer. Adapter la politique légère et l'accès opérateur ; réutiliser les composants de page et la charte existante. Les statuts électroniques doivent rester distincts des statuts commerciaux, paiements et comptabilisation.

Le choix FR/EN/AR est enregistré mais le shell n'est pas réellement traduit et utilise des polices latines. Le module fournira ses libellés français/arabe et son sens RTL explicitement ; il ne présentera pas le reste de l'ERP comme intégralement traduit.

## Vérification officielle et limites

Les informations réglementaires seront classées « officiel », « annoncé » ou « non confirmé », avec date, lien et portée. La matrice complète sera conservée à côté de cet audit.

- L'[OMPIC](https://www.ompic.ma/fr/identifiant-commun-de-lentreprise) décrit l'ICE sur 15 positions. Ce contrôle de forme ne constitue pas une vérification auprès d'un registre.
- Le [plan stratégique DGI 2024-2028, page 39](https://www.finances.gov.ma/Publication/dgi/2024/plan_strategique_2024_2028.pdf) inscrit la mise en place de la facturation électronique comme chantier. Ce document ne fournit pas de contrat API ni de profil XSD marocain.
- Le [CGI 2026 publié par le ministère](https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-FR.pdf) est la référence fiscale à examiner. Le téléchargement direct a échoué pendant cette vérification ; les passages non relus ne seront pas déclarés juridiquement vérifiés sur la seule base d'un résumé commercial.
- La [DGSSI, FAQ loi 43-20](https://www.dgssi.gov.ma/sites/default/files/legislative/brochure/2024-10/FAQ%20relatif%20%C3%A0%20la%20loi%2043-20__v1.1.pdf) distingue les services de confiance. Leur intégration suppose un prestataire et des conditions effectives ; une empreinte locale n'est pas une signature qualifiée.
- La [CNDP](https://www.cndp.ma/notifier-un-traitement/) décrit les formalités relatives aux traitements et transferts. Les formalités de l'exploitant ne sont pas validées par du code.

Aucune spécification opérationnelle DGI, autorisation de connexion, clé ou certification n'a été fournie. Aucune API ne sera inventée. Le mode officiel et la signature qualifiée resteront indisponibles. Le format retenu est [UBL 2.1 OASIS](https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.html), **générique préparatoire**, sans prétendre qu'il est le profil officiel marocain.

## Architecture retenue

1. DTO à décimaux textuels, calculs entiers exacts, contrôles explicites et règle de calcul versionnée.
2. Capture fiscale figée des parties et des lignes ; comparaison de l'empreinte source avant émission pour refuser une préparation devenue obsolète.
3. Versions, XML et PDF issus du même instantané ; empreintes séparées pour instantané, fichier et XML canonicalisé. Validation XSD réelle avec les schémas officiels locaux épinglés et résolution réseau interdite.
4. Archives PostgreSQL privées en lecture tenant, append-only ; hash vérifiable. Ce stockage ne sera pas déclaré WORM ni archive légale certifiée.
5. Statuts internes séparés, historique append-only, outbox persistante, leases et reprises. Toute acceptation/rejet du connecteur interne portera « Simulation ».
6. Interface de signature avec références de prestataire/certificat ; aucune clé privée en clair ni champ acceptant une clé privée.
7. Supervision admin : erreurs, temps, intégrité, comptabilité liée, traitements bloqués, disponibilité, preuve de sauvegarde distincte de l'intégrité d'un fichier.
8. Veille sur sources officielles autorisées : horodatage, empreinte, changements et revue humaine, sans changement automatique des règles de production.

## Risques et mesures de non-régression

- Ne pas modifier les RPC financiers ni leur politique de numérotation pour ajouter un second moteur d'émission.
- Ne pas recalculer ou renuméroter les anciennes pièces en place ; un écart exact bloque le nouveau document et demande une correction autorisée.
- Ne pas déclarer XSD valide après un simple parsing XML. Les tests devront rejeter un XML bien formé mais hors schéma.
- Différencier les DTD internes des schémas OASIS épinglés et les DTD interdites des documents entrants. Aucun chargement HTTP/fichier arbitraire pour résoudre une entité.
- Ne pas confondre hash JSON TypeScript et représentation textuelle JSONB PostgreSQL : le contrat doit être explicite et testé.
- Ne pas déclencher un job global ou envoyer des données fiscales à un tiers pendant la recette.
- Le build doit inclure WASM, schémas et polices nécessaires au runtime Vercel. Le validateur candidat doit être éprouvé avant adoption.

## Sauvegarde et publication

Sauvegarde source préalable complète : branche `codex/backup-before-e-invoicing-20261031`, bundle autonome `C:/Users/XXX/Documents/Felexia/backups/felexia-before-e-invoicing-20261031.bundle`, vérifié avant le développement. Travail isolé sur `codex/e-invoicing-maroc-20261031`.

Aucune migration de ce module ne sera appliquée à la production pendant le développement. La migration additive sera testée dans PostgreSQL isolé. La publication de production attend une autorisation explicite conformément au cahier des charges. Les archives Git sauvegardent le code, pas la base hébergée ni les fichiers Storage.

## Plan d'implémentation et validation

1. Socle exact, DTO, XML/XSD/canonicalisation, connecteurs désactivé/simulation et tests du domaine.
2. Migration additive, RLS/RPC, immutabilité, versions, traitements persistants et tests multi-entreprises/concurrence.
3. Services serveur, PDF réel, téléchargements protégés, préservation des impressions historiques émises.
4. Interface FR/AR, configuration, supervision et veille avec validation humaine.
5. Intégration isolée, tests de panne/reprise, non-régression, build et inspection visuelle des PDF et écrans.
6. Documentation utilisateur/technique, matrice réglementaire, sécurité, tests, limites et checklist de publication.

Les livrables finaux distingueront : IMPLÉMENTÉ, TESTÉ, SIMULÉ, EN ATTENTE DGI et NON VÉRIFIÉ. Le rapport de tests ne devra pas assimiler une fixture, un test de base isolée et un parcours navigateur réellement connecté.
