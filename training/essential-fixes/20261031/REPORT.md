# Corrections Essentiel et préparation de la recette

État : correctifs préparés et vérifiés localement. Le SQL 098–101 est appliqué : quatre indicateurs confirmés par l'utilisateur et nouveaux contrats visibles dans PostgREST. **La nouvelle recette réelle à trois utilisateurs n'est pas encore exécutée** : la publication est en cours de préparation. Les résultats attendus des scripts ne sont pas des résultats obtenus.

## Corrections livrables

| Constat d'audit | Correction |
| --- | --- |
| Abonnement affiché absent, erreurs masquées | Lecture sans relation ambiguë, état d'erreur explicite et aucune création d'essai pendant une consultation. |
| Fin d'essai sans restriction, abonnement modifiable par un membre | Garde serveur et base, échéance future requise, données de facturation réservées au serveur ; consultation et exports conservés. |
| Paiement et périodicité | Souscription possible pendant l'essai, gestion d'un abonnement existant par portail, réservation contre les doubles préparations, traitement Stripe durable et contrôlé. |
| Compte perdu | Demande de récupération, callback PKCE, preuve signée courte liée au compte et changement de mot de passe sécurisé. |
| Factures et journaux partiellement enregistrés | Enregistrement atomique, contrôles des lignes et totaux, numéros préservés lors d'une modification de brouillon. |
| Corrections après comptabilisation | Montants et annulation des pièces comptabilisées verrouillés ; affectation/désaffectation des avoirs conservée sans création de trésorerie. |
| Devises mélangées | Nouvelles opérations Essentiel limitées à MAD, avec contrôles de la devise du compte. |
| Droits et références entre entreprises | Protections des contacts/adresses et des relations métier ; rôle et entreprise contrôlés dans les actions et dans PostgreSQL. |
| Avoirs incomplets | Édition, affectation, retrait et comptabilisation des avoirs clients ; parcours complet des avoirs fournisseurs avec compteur AVF, impression et CSV. |
| Historiques et sorties incomplets | Pagination visible, recherche et filtres, lectures exhaustives, CSV filtrés, liens vers l'écriture correspondant au bon règlement. |
| Ergonomie quotidienne | Archives restaurables, catalogue facultatif, actions cachées en lecture seule, instruction d'envoi manuel des factures, assistance accessible. |
| Gestion des équipiers | Erreurs de mise à jour remontées, entreprise contrôlée et confirmation de la ligne effectivement modifiée. |
| Exploitation | Dépendances de production corrigées, santé de la base contrôlée, cron fermé sans secret, workflow de vérification et procédure de reprise. |

Le stock et les modules avancés restent sur demande. Les transferts internes se corrigent par un transfert inverse qui conserve l'historique ; la fiche l'explique.

## Preuves déjà obtenues

Les fixtures financières utilisent exclusivement des données synthétiques PostgreSQL/PGlite. Elles ne constituent pas une entreprise nouvellement inscrite dans le service public.

| Vérification | Preuve |
| --- | --- |
| Intégrité financière : 49 assertions dans chacun des deux modes RLS | `finance-strict.json`, `finance-relaxed.json` |
| Avoirs clients : 43 assertions sur trois configurations | `credit-native.json`, `credit-strict.json`, `credit-relaxed.json` |
| Avoirs fournisseurs : 50 assertions sur trois configurations et concurrence des affectations/paiements | `supplier-credit-*.json`, `supplier-credit-concurrency.json` |
| Abonnement : 51 assertions dans chacun des deux modes RLS, dont refus d'un quatrième utilisateur | `subscription-postgres-strict.json`, `subscription-postgres-relaxed.json` |
| Lecture sans bootstrap : 144 assertions sur les trois rôles | `read-subscription-guards.json` |
| Routes checkout/portail : 24 contrôles ; handler Stripe/récupération : 25 contrôles | `checkout-fixture-tests.json`, `webhook-recovery-tests.json` |
| Récupération : 26 contrôles des actions/callback ; restauration de l'état de recette : 12 scénarios de panne | `recovery-action-tests.json`, `expiry-harness-tests.json` |
| Routes de gestion d'équipe : 55 contrôles isolés et aucun appel SMTP | `team-handlers.json` |
| Middleware : 17 contrôles des accès personnels, financiers et des exports par rôle et échéance | `middleware-access-tests.json` |
| Services, pagination et historique : 30 contrôles, dont une limite API artificielle de 37 lignes | `workflow-services.json` |
| Avoir fournisseur imprimable : 14 contrôles SSR | `supplier-credit-print-tests.json` |
| Santé de la vraie base et refus du cron sans secret/avec mauvais secret | `operations.json` |
| Restauration locale de 81 tables, droits, données et réapplication du bundle inchangées | `restoration.json` |

Le build de production, le typage, le lint applicatif, les régressions métier, le profil léger, le profil Opérateur et le modèle de numérotation passent. L'audit npm des dépendances de **production** ne signale aucune vulnérabilité ; les alertes des outils de développement restent distinctes.

Le premier passage Linux a révélé un test de fin de mois fondé sur l'ancienne règle horaire de Casablanca. Le runtime est désormais aligné sur Node.js 22 à jour et le test couvre les deux périodes IANA, avant et après septembre 2026. Aucun décalage fixe n'est ajouté à l'application.

Le préflight public effectué en lecture seule trouve 1 086 écritures, aucune source comptable dupliquée, aucune écriture comptabilisée vide ou déséquilibrée, aucun total d'en-tête divergent et aucun compte de trésorerie non MAD. Il identifie un ancien abonnement actif sans date de fin : ses données restent conservées, mais l'écriture sera refusée jusqu'à régularisation de sa véritable échéance.

## Installation et recette réelle en attente

Appliquer intégralement `supabase/essential-launch-098-101.sql`. Les quatre indicateurs de fin doivent être `true`. Empreinte SHA256 : `e22e2c3380f757a20fd59a0faf11ca5a726236c3843db748291a565f13f553e2`. L'installation est transactionnelle et ne renumérote pas les documents. La sauvegarde source préalable est `../backups/felexia-before-essential-fixes-20261031.bundle`.

Les scripts de recette sont limités à une entreprise fictive explicitement marquée et aux trois alias de la boîte Gmail autorisée. Le manifeste privé, les mots de passe et les liens reçus restent hors du dépôt.

Ordre prévu : inscription et entreprise → invitations réellement reçues → activation opérateur/lecture seule → équipe → opérations nominales → restrictions de rôle → mouvements et transferts → avoirs, archives, numérotation et exports → avoir fournisseur → simulation contrôlée d'échéance avec restauration → récupération par email → comptabilisation finale et rapprochement en lecture seule. Le navigateur doit en complément valider les formulaires, les téléchargements, les impressions, les trois interfaces et le mobile.

Le scénario préparé vise une banque finale de 24 MAD, une créance client nette de 216 MAD, aucune dette fournisseur et 11 écritures équilibrées totalisant 1 229 MAD. **Ces montants sont des attentes de recette, pas une preuve d'exécution réelle.**

## Vérifications externes restantes

- Réception réelle des invitations et de la récupération via le SMTP actuellement configuré.
- Cycle Stripe de test de bout en bout et webhook du déploiement. La lecture du compte et des prix réels confirme les montants publiés et la capacité d'encaissement, sans effectuer d'achat.
- `CRON_SECRET`, exécution planifiée et surveillance externe sur le projet Vercel qui héberge Felexia Pro.
- Sauvegarde et restauration du projet Supabase hébergé, y compris les octets Storage. La restauration locale synthétique ne les valide pas.
- Informations légales réelles de l'éditeur et choix explicite de confirmation email à l'inscription ; le projet actuel auto-confirme les inscriptions.

Le guide `docs/OPERATIONS.md` décrit les procédures d'exploitation. Ces points ne doivent pas être présentés comme vérifiés par les tests isolés.
