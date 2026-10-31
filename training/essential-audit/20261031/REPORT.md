# Audit de la version Essentiel de Felexia Pro

Audit du 31 octobre 2026, sur la version publiée `31b17b027142254e61b4d10c80371025a5659061` et le domaine `https://www.felexia.pro`.

Le périmètre fonctionnel choisi est adapté au lancement : entreprise, équipe, clients/fournisseurs, factures vente/achat, règlements, trésorerie et journaux. Les manques les plus importants concernent la fiabilité des corrections, les protections d'accès direct et le cycle d'abonnement. **Une ouverture commerciale large est déconseillée avant correction des priorités P1.**

L'audit n'a modifié ni code applicatif, ni migration, ni donnée métier de production. Les reproductions d'écritures ont utilisé PostgreSQL jetable, des entreprises fictives et un rollback. Aucun email ni paiement Stripe n'a été déclenché. Les nouveaux fichiers de ce dossier sont des rapports et des reproductions d'audit.

## État du socle essentiel

| Domaine | Résultat |
| --- | --- |
| Navigation | Six menus légers cohérents ; les autres modules restent sur demande. |
| Entreprise et équipe | Création et invitation validées dans les preuves de lancement antérieures ; écrans et formulaires disponibles actuellement. Des lacunes RLS complémentaires sont identifiées ci-dessous. |
| Vente et achat | Parcours nominal cohérent ; saisie de lignes libres et calculs présents. Modification d'un brouillon client défectueuse. |
| Règlements | Paiements partiels/complets et affectations cohérents sur les données QA ; annulation après comptabilisation et mélange de devises défectueux. |
| Trésorerie | Accueil, comptes et mouvements disponibles ; consultation détaillée en erreur serveur. |
| Journaux | Cinq écritures QA équilibrées ; risque d'exports et de totaux incomplets à volume important. |
| Numérotation | Migration 097 active, écran réel disponible, corrections auditées et protection des numéros déjà attribués validées. |
| Impressions | Charte et PDF longs vérifiés lors de la publication précédente ; aucun besoin de refaire le design pour résoudre les défauts métiers présents. |
| Abonnement | Essai présent mais affiché absent ; expiration, conversion payante et webhook à corriger. |
| Exploitation | Build et contrôles ciblés réussis ; dépendances vulnérables et restauration des données à traiter. |

## Priorités P1 avant ouverture commerciale large

P1 désigne ici une correction nécessaire avant lancement large. Le niveau de preuve est indiqué pour éviter de confondre un défaut reproduit avec un risque de code ou une configuration externe non vérifiée.

### S01 Dépendances de production vulnérables

**Confirmé par le registre npm et les avis des éditeurs.** `npm audit --omit=dev` signale cinq paquets concernés : Next.js classé critique ; Sharp, Zod, Nano ID et source-map-js classés élevés. Le verrouillage actuel contient notamment Next 16.3.0, Sharp 0.35.3 et Zod 4.4.3.

L'avis officiel [Next GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) décrit un risque lié à l'optimisation d'images et indique Next 16.4.1 ou Sharp au moins 0.35.5 comme correctifs pour cet avis. [L'avis Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) concerne l'épuisement mémoire lors de validations de collections et indique 4.6.6 comme version corrigée. L'applicabilité précise dépend des chemins utilisés ; aucune exploitation n'a été tentée et aucun incident n'est démontré.

**Action :** mettre à jour les versions compatibles et leurs dépendances, relire les guides Next correspondants, puis exécuter l'audit, le build et les tests essentiels. Supprimer aussi l'autorisation inutile des IP locales dans la configuration de production (`next.config.mjs:10`, `dangerouslyAllowLocalIP: true`) après vérification des besoins réels.

Preuve : `dependencies.json` et `package-lock.json`.

### A01 L'abonnement existant est affiché comme absent

**Reproduit en production.** L'entreprise fictive a une ligne `trialing / essentiel` en base. L'écran `/parametres/abonnement` affiche pourtant « Vous n'avez pas encore activé d'essai ni choisi d'abonnement » ; l'accueil des paramètres affiche « Aucun ».

La sélection `plan:subscription_plans(code, slug)` rencontre deux relations possibles et retourne `PGRST201`. Les loaders ignorent l'erreur et la traitent comme une absence d'abonnement. La même lecture avec une relation explicite réussit.

**Action :** préciser la FK dans les deux loaders, traiter l'erreur séparément d'une absence réelle et vérifier l'affichage de l'essai, du plan, des dates et des limites.

Sources : `src/lib/subscriptions/plan-access.ts:64`, `src/lib/auth.ts:104`. Preuves : `live-runtime.json`, `abonnement-production.jpg`.

### A02 Les états d'abonnement ne protègent pas les créations

**Reproduit dans PostgreSQL isolé avec les migrations réelles.** La création d'une facture reste autorisée pour un essai expiré, un abonnement résilié et un abonnement impayé, même lorsque les dates sont dépassées.

Les actions exigent un membre actif dans l'entreprise ; la garde de module considère principalement le plan. Le calcul d'un droit d'accès lié à l'échéance n'est pas appliqué à ces écritures.

**Action :** définir la politique de fin d'essai et d'impayé, puis l'appliquer côté serveur et base. Préserver la consultation et la récupération des données ; contrôler les nouvelles écritures selon la politique choisie.

Sources : `src/lib/invoice-actions.ts:142`, `src/lib/invoice-actions.ts:235`, `src/lib/auth/require-subscription.ts:36`. Preuves : `rls-strict.json`, `rls-relaxed.json`.

### A03 Un membre Lecture seule peut modifier les données d'abonnement

**Reproduit dans PostgreSQL isolé, dans deux configurations de RLS.** Un membre `viewer` a pu modifier son propre abonnement en `active`, `premium` et échéance 2099. Les policies historiques autorisent les membres, malgré leur nom contenant « admin » ; le correctif Opérateur ne suffit pas à protéger les autres rôles.

**Action :** réserver les états, plans, échéances et références de facturation aux opérations serveur autorisées. Les membres doivent lire leur abonnement, sans s'accorder eux-mêmes de droits commerciaux.

Source : `supabase/migrations/039_subscription_billing_invitations.sql:93`. Preuves : `rls-strict.json`, `rls-relaxed.json`. Ce contournement n'a pas été tenté en production.

### A04 Le webhook Stripe perd des informations et accuse réception d'erreurs

**Quatre défauts reproduits sur le véritable handler avec Stripe et la base remplacés par des fixtures locales.** Le SDK installé utilise une API récente, mais le code lit encore les périodes directement sur l'abonnement et `invoice.subscription`. Avec les objets modernes, les périodes deviennent nulles et les événements `invoice.paid` / `invoice.payment_failed` sont ignorés tout en retournant un succès.

Le handler ignore également les objets `error` retournés par certaines écritures Supabase : une écriture refusée peut être acquittée comme traitée. Un encaissement peut alors ne pas être traduit fidèlement dans l'application et ne pas bénéficier d'une nouvelle tentative fiable.

**Action :** adapter les objets à la version API utilisée, vérifier les écritures, conserver une idempotence durable et ne marquer un événement traité qu'après réussite. Tester activation, renouvellement, échec, résiliation et réception répétée sur un environnement Stripe de test avant la boucle réelle.

Sources : `src/lib/stripe-webhook.ts:114`, `:126`, `:142`, `:181`, `:241`. Preuve : `webhook-isolated.json`. Référence : [changement officiel des périodes Stripe](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end).

### A05 Le passage de l'essai à l'abonnement mensuel est bloqué

**Confirmé par lecture du code ; actuellement masqué par A01.** Le bouton devient « Plan actuel » et désactivé dès que le plan et le cycle correspondent, sans distinguer un essai, un abonnement actif et un abonnement résilié. Un essai Essentiel mensuel ne peut donc pas être converti par le choix du même mensuel.

**Action :** distinguer « En essai », « Souscrire » et « Abonnement actif », et conserver un chemin de réactivation après résiliation. Tester ce parcours une fois A01 corrigé.

Sources : `src/components/settings/subscription-manage.tsx:53`, `:290`, `:341`.

### U01 Aucun parcours de récupération du mot de passe

**Manque confirmé dans les sources.** La connexion ne propose pas « Mot de passe oublié » ; aucun envoi de récupération, route de récupération ni traitement `PASSWORD_RECOVERY` n'est présent. Changer le mot de passe depuis une session déjà ouverte ne permet pas de retrouver un compte perdu.

**Action :** ajouter demande de récupération, lien sécurisé, écran de définition du nouveau mot de passe, gestion des liens expirés et message de succès. Tester le mail réel sur les adresses de test autorisées.

Source : `src/components/auth/login-form.tsx:16` et recherche globale dans `src`.

### S02 La Lecture seule ne protège pas toutes les coordonnées

**Reproduit dans PostgreSQL isolé, strict et assoupli.** Un `viewer` peut insérer et modifier les contacts et adresses des tiers de son entreprise via un accès direct à la base. Les protections des factures et de la fiche principale du tiers ne couvrent pas ces tables secondaires. L'accès à une autre entreprise reste refusé dans ces tests.

**Action :** compléter les gardes sur `third_party_contacts` et `third_party_addresses` et tester les quatre opérations par rôle, y compris par API directe.

Sources : `supabase/migrations/002_third_parties_complete.sql:233`, `094_readonly_financial_documents.sql:28`, `096_fix_operator_contact_numbering.sql:41`. Preuves : `rls-strict.json`, `rls-relaxed.json`.

### S03 Des références de tiers peuvent traverser la frontière entre entreprises

**Reproduit dans PostgreSQL isolé.** Un administrateur A, qui ne peut pas lire un tiers B, peut enregistrer une facture A avec l'UUID du client ou fournisseur B. Les FK simples vérifient l'existence, pas le couple entreprise/tiers. Les actions de création ne vérifient pas systématiquement cette appartenance.

Ce constat démontre une lacune d'intégrité des relations ; il ne démontre pas une fuite des champs privés du tiers étranger.

**Action :** vérifier les relations dans les actions et les contraindre en base pour chaque référence métier interentreprises.

Sources : `src/lib/invoice-actions.ts:151`, `:192`, `src/lib/purchase-actions.ts:477`, `supabase/migrations/014_customer_invoicing_v1.sql:5`. Preuve : `finance-isolated.json`.

### F01 Modifier une facture brouillon vide son numéro ou échoue

**Reproduit dans PostgreSQL isolé et relié au payload réel.** La modification réutilise un payload contenant `invoice_number: ""`. Pour l'administrateur, cette valeur peut vider le numéro ; pour l'opérateur, le changement du numéro est refusé. Le générateur automatique ne remplit pas cette valeur lors d'un UPDATE.

**Action :** conserver le numéro lors d'une modification et séparer le payload de création du payload de mise à jour. Valider création → modification → relecture → impression pour administrateur et opérateur.

Sources : `src/lib/invoice-actions.ts:191`, `:268`, `supabase/migrations/014_customer_invoicing_v1.sql:146`, `097_document_numbering_controls.sql:160`, `:269`. Preuve : `finance-isolated.json`.

### F02 Annuler un règlement comptabilisé désynchronise la trésorerie et le journal

**Reproduit dans PostgreSQL isolé.** L'annulation autorisée à l'administrateur annule le paiement et archive son mouvement de trésorerie, mais laisse son écriture comptable validée. Dans le cas synthétique, la trésorerie revient à zéro et l'écriture de 100 reste `posted`. Le blocage existant concerne uniquement l'opérateur.

**Action :** soit interdire les corrections monétaires de règlements comptabilisés pour tous les rôles, soit proposer une correction avec contrepassation atomique et guidée. Le parcours doit expliquer le résultat au gestionnaire.

Sources : `src/components/payments/customer-payment-detail.tsx:50`, `src/components/purchases/supplier-payment-detail.tsx:66`, `supabase/migrations/20260810213138_fix_erp_integrity_and_transfers.sql:1310`, `:1785`, `095_operator_profile.sql:178`. Preuve : `finance-isolated.json`.

### F03 Un règlement MAD peut alimenter un compte EUR sans conversion

**Reproduit dans PostgreSQL isolé.** Le formulaire de compte accepte une devise libre ; le RPC crée un règlement et un mouvement MAD, puis ajoute le montant brut au solde du compte. Un compte EUR à zéro devient ainsi 100 EUR après un paiement de 100 MAD.

**Action simple pour Essentiel :** limiter réellement les comptes et règlements à MAD dans l'interface, le serveur et la base. La multidevise complète peut être traitée plus tard si elle est souhaitée.

Sources : `src/components/treasury/treasury-account-form.tsx:38`, `supabase/migrations/20260810213138_fix_erp_integrity_and_transfers.sql:55`, `:1026`, `:1068`, `:1641`. Preuve : `finance-isolated.json`.

### T01 La consultation détaillée de trésorerie ne charge pas

**Reproduit deux fois en production, puis confirmé en local par l'exception.** `/tresorerie/consultation` affiche une erreur serveur. Les trois requêtes de données correspondantes réussissent avec les trois mouvements QA : le problème est dans le rendu.

Le bouton Exporter est toujours désactivé (`csvUrl = ""`). Le composant Button ajoute alors un `onClick` et le transmet au `Link` client depuis un composant serveur. React refuse ce gestionnaire : `Event handlers cannot be passed to Client Component props`.

**Action :** corriger la frontière serveur/client du bouton, puis implémenter l'export ou présenter clairement son indisponibilité. Vérifier le chargement réel et l'export de cet écran.

Sources : `src/app/tresorerie/consultation/page.tsx:53`, `:59`, `src/components/ui/button.tsx:61`. Preuves : `treasury-render-error.json`, `treasury-consultation-error.jpg`, `treasury-consultation-data.json`.

### V01 Les historiques et exports doivent rester exhaustifs

**Limites confirmées dans le code, sans injection de volume en production.**

- Ventes : le service retourne 25 lignes par page, mais l'écran ignore les métadonnées de pagination et n'affiche pas de navigation. À partir de 26 factures, le parcours ne permet pas de feuilleter l'historique complet.
- Trésorerie : les mouvements sont limités à 100 ; la fiche compte à 50, sans navigation vers les lignes suivantes dans ces parcours.
- Journaux et exports : la valeur `pageSize: 10000` n'entraîne aucune pagination de la requête ; les lignes sont également chargées en un seul appel. Les résultats peuvent être tronqués au plafond PostgREST. Le seuil effectif du projet reste à mesurer ; les cinq écritures QA ne reproduisent pas ce volume.

**Action :** paginer listes et lectures complètes d'export, ajouter filtres utiles, puis tester au-delà des seuils 25/50/100 et du plafond API. Comparer nombre de lignes, sommes attendues et fichier exporté.

Sources : `src/lib/invoices.ts:263`, `src/app/facturation/factures/page.tsx:23`, `src/lib/treasury.ts:173`, `:192`, `src/lib/accounting.ts:245`, `:256`, `:323`, `:345`.

### F04 Les enregistrements financiers ne sont pas tous transactionnels

**Risque structurel confirmé par le code, interruption non provoquée en production.** L'en-tête de facture et ses lignes sont écrits par des appels séparés ; lors d'une modification, les anciennes lignes sont supprimées avant l'insertion des nouvelles. Une panne intermédiaire peut laisser un brouillon incomplet. La comptabilisation écrit également un en-tête `posted` puis ses lignes séparément.

**Action :** regrouper les opérations sensibles dans des transactions et tester explicitement les erreurs intermédiaires et le double clic. Vérifier en base la contrainte d'unicité de la source comptable avant de conclure sur les doublons : la DDL historique complète des tables comptables n'est pas présente dans le dépôt.

Sources : `src/lib/invoice-actions.ts:236`, `:269`, `src/lib/purchase-actions.ts:640`, `:668`, `src/lib/accounting-actions.ts:438`, `:519`, `:530`.

## Compléments P2 de l'usage essentiel

| Sujet | Manque et résultat attendu | Source |
| --- | --- | --- |
| Corrections d'avoirs clients | Une mauvaise affectation ne peut pas être retirée : le retrait est un stub, alors que l'annulation exige ce retrait. L'édition est un placeholder. Prévoir modification du brouillon et correction guidée des affectations. | `src/lib/credit-note-actions.ts:292`, `:340` ; `src/app/facturation/avoirs/[id]/edit/page.tsx:16` |
| Avoirs et journaux | Pas de comptabilisation guidée d'avoir client ; la correction exige une écriture manuelle. Un avoir fournisseur est conseillé par l'interface sans workflow financier dédié. Définir le traitement simple des erreurs de vente et d'achat. | `src/components/credit-notes/customer-credit-note-detail.tsx` ; `src/lib/accounting-actions.ts` ; `src/components/purchases/supplier-invoice-detail.tsx:383` |
| Contacts archivés | Le filtre « Archivés » combine un statut archivé avec `archived_at IS NULL`, donc ne retrouve pas les contacts archivés. Ajouter consultation, restauration et confirmation d'archivage. | `src/lib/third-parties.ts:45` ; `src/lib/third-party-actions.ts:362` |
| Catalogue facultatif | Le catalogue est proposé, mais ses sélecteurs sont cachés dans les factures légères. Ajouter un accès facultatif « Depuis mon catalogue », sans imposer de stock. | `src/app/articles/page.tsx:19` ; `src/components/invoices/invoice-lines-editor.tsx:92` ; `src/components/purchases/supplier-invoice-form.tsx:181` |
| Export des données | Les ventes, achats et tiers n'ont pas de sortie structurée simple dans le parcours light ; le CSV de consultation trésorerie est vide. Ajouter des exports filtrés et exhaustifs. | Pages listes ; `src/app/tresorerie/consultation/page.tsx:53` |
| Rechercher et filtrer | La recherche ventes ne porte que sur le numéro ; les achats manquent de recherche client/fournisseur, dates et pagination visibles. | `src/lib/invoices.ts:280` ; `src/app/achats/factures/page.tsx:11` |
| Erreurs et états vides | Une erreur de lecture achat peut être rendue comme « Aucune facture ». Distinguer panne temporaire, aucun résultat et première utilisation pour éviter une ressaisie inutile. | `src/lib/purchases.ts:768` |
| Totaux de consultation trésorerie | Les totaux sont calculés sur la page courante ; certains filtres sont appliqués après pagination et calcul. À corriger avant d'utiliser cet écran comme état de synthèse. Le cas volumineux n'a pas été exercé en production. | `src/lib/treasury.ts:543`, `:555` |
| Envoi de facture | « Marquer envoyée » change seulement le statut. L'envoi est manuel après PDF ; l'expliquer ou ajouter un envoi réel avec pièce jointe. Cela ne prouve aucune panne SMTP. | `src/components/invoices/customer-invoice-detail.tsx:79` ; `src/lib/invoice-actions.ts:291` |
| Quota annoncé | L'offre annonce 500 documents commerciaux/mois, mais le compteur lit la GED `documents` et la garde de création n'a pas d'appelant. Aligner promesse, calcul et contrôle serveur. | `src/app/parametres/abonnement/page.tsx:21` ; `src/lib/subscriptions/plan-access.ts:264` |
| Changement de périodicité | Le choix d'un autre cycle peut ouvrir une nouvelle souscription Stripe au lieu de modifier l'existante. Risque de double abonnement à corriger via portail ou mise à jour de souscription. Aucun achat réalisé. | `src/components/settings/subscription-manage.tsx:101` ; `src/app/api/stripe/checkout/route.ts:99` |
| Assistance | L'aide ne donne pas de contact direct alors que les messages d'erreur invitent à contacter l'assistance. Ajouter une entrée accessible à tous les rôles. | `src/components/layout/help-dropdown.tsx:14` |

Les chemins de composants de cette table servent à localiser les écrans ; les scripts et preuves détaillées du dossier permettent de reproduire les principaux défauts sans toucher la production.

## Exploitation et configurations à terminer ou à prouver

1. **Emails de production.** Gmail SMTP a été déclaré enregistré par l'utilisateur. Cet audit n'a envoyé aucun nouvel email et ne peut pas confirmer le prestataire ni la réception actuelle. Valider invitation, renvoi, expiration et récupération sur les comptes de test autorisés. Le service Supabase par défaut est prévu pour un usage de test, selon la [documentation SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
2. **Vérification des adresses.** `/auth/v1/settings` indique actuellement `mailer_autoconfirm=true`. L'inscription n'exige donc pas de confirmation email. Choisir explicitement la politique souhaitée ; une inscription réussie dans cet état ne valide pas la réception d'un email de confirmation.
3. **Paiement réel.** La présence de boutons et de variables locales ne valide pas la configuration Vercel/Stripe, les prix, la signature du webhook et l'activation après paiement. Terminer les tests Stripe après correction A01–A05, puis la vérification de production autorisée.
4. **Sauvegarde des données et restauration.** Les bundles Git sauvegardent le code. Aucune restauration de base et de fichiers n'est prouvée dans les éléments audités. Vérifier le plan Supabase, la rétention, la sauvegarde des pièces jointes/logos et une restauration isolée. Les sauvegardes de base [n'incluent pas les objets Storage](https://supabase.com/docs/guides/platform/backups).
5. **Surveillance.** `/api/health` répond `ok` sans vérifier la base. Aucune configuration versionnée de surveillance et aucun workflow `.github` ne sont présents. Une surveillance externe peut exister : elle n'a pas été démontrée. Ajouter alertes d'indisponibilité, erreurs métiers et échecs du webhook.
6. **Contrôles avant déploiement.** Le build fonctionne, mais les tests et le lint ne sont pas imposés par un pipeline versionné. Faire passer les contrôles critiques avant chaque publication.
7. **Cron.** Le cron de notifications accepte les appels sans authentification si `CRON_SECRET` est absent (`src/app/api/cron/trial-notifications/route.ts:8`). La variable est absente localement ; sa présence en production n'a pas été vérifiée. Fermer ce comportement par défaut et vérifier la planification effective, sans appeler le cron durant l'audit car il écrit des notifications.
8. **Identité de l'éditeur.** La page légale publique indique que forme juridique, capital, siège et identifiants ne sont pas renseignés. Compléter avec les informations réelles de Felexia Conseils et faire valider les textes destinés à la commercialisation. Aucun numéro ni donnée juridique ne doit être inventé.

## Ordre de travail conseillé

| Lot | Contenu | Critère de sortie |
| --- | --- | --- |
| 1 Sécurité et données | S01–S03, A03, F01–F04 | Dépendances corrigées ; refus d'écriture par rôle et tenant ; modification/annulation sans divergence ; rollback testé. |
| 2 Abonnement et accès | A01, A02, A04, A05, U01 | Essai réel affiché ; fin d'essai maîtrisée ; paiement/renouvellement/échec/résiliation cohérents ; récupération de compte reçue et utilisable. |
| 3 Historiques et corrections | T01, V01, avoirs, archives, exports | Toutes les pages chargent ; historique et fichiers exhaustifs ; erreurs de saisie corrigeables de façon guidée. |
| 4 Préparation du lancement | SMTP, restauration, surveillance, support, informations publiques | Preuves réelles et procédure de support ; nouveau parcours complet administrateur/opérateur/lecture seule sur un environnement isolé. |

Le stock, la RH, les commandes logistiques et la comptabilité avancée ne sont pas nécessaires pour fermer ces écarts. Le lancement peut rester centré sur le périmètre léger déjà retenu.

## Vérifications et limites

- **26 pages/formulaires en ligne contrôlés avec le compte QA existant :** 25 chargent, une consultation trésorerie échoue. Le chargement ne valide pas à lui seul la justesse fonctionnelle : l'abonnement chargé affiche une information erronée.
- **41/41 contrôles financiers en lecture authentifiée réussis de nouveau :** vente 240 MAD payée, achat 120 MAD payé, banque 120 MAD, cinq écritures équilibrées, affectations et isolation de lecture conservées.
- **13 assertions PostgreSQL isolées** reproduisent les défauts de correction de numéro, annulation comptabilisée, devise et relation de tiers ; rollback vérifié.
- **10 observations d'accès dans chacun des deux modes PostgreSQL isolés**, plus **4 reproductions du vrai handler Stripe** avec frontières simulées. Ces observations confirment des défauts ; elles ne sont pas des tests de non-régression réussis de l'application.
- Build de production, typage du build, lint de `src`, régressions métier, règles du profil léger, règles Opérateur et modèle de numérotation réussis. Les anciennes suites 093–097 et les preuves d'impression restent consultables dans les dossiers voisins.
- Aucun test de charge, achat réel, nouvel envoi SMTP, restauration de production, scan offensif ou modification de document client durant cet audit. Les limites de volume sont établies par le code ; leur seuil API exact reste à mesurer.
- Le schéma historique complet des tables comptables manque au dépôt. Les tests isolés reprennent le schéma minimal explicite du banc 097 ; l'intégralité de la DDL de production et des index doit être réconciliée avant les corrections de concurrence.

### Preuves de ce dossier

`public-pages.json`, `financial-live-readonly.json`, `live-runtime.json`, `dependencies.json`, `finance-isolated.json`, `rls-strict.json`, `rls-relaxed.json`, `webhook-isolated.json`, `treasury-render-error.json`, `treasury-consultation-data.json`, `build.txt` et les captures d'écran.

Reproductions isolées :

```powershell
node training/essential-audit/20261031/verify-finance-isolated.mjs --pglite-root=<dossier-des-dependances-de-test>
node training/essential-audit/20261031/verify-access-isolated.mjs --pglite-root=<dossier-des-dependances-de-test>
node training/essential-audit/20261031/verify-access-isolated.mjs --pglite-root=<dossier-des-dependances-de-test> --relaxed-v3
node training/essential-audit/20261031/verify-webhook-isolated.cjs
```

Ces scripts documentent les défauts actuels et doivent être adaptés en tests d'attentes corrigées lors de leur résolution.
