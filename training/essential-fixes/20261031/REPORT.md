# Recette finale Felexia Pro — Essentiel

[Synthèse des validations et limites](FINAL-CHECKS.json). La version applicative `3970b91` est publiée ; les deux CI [main](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41244615530) et [branche de recette](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41244629030) réussissent, builds compris.

Rapport final — 31 octobre 2026. Les opérations réelles, les vérifications HTTP, les 20 contrôles du navigateur et la préparation Checkout sans paiement ont réussi. Le correctif `3970b91` est publié en production ; les actions externes encore nécessaires sont identifiées en fin de rapport.

## Résultat obtenu

Une nouvelle entreprise `FELEXIA RECETTE ESSENTIELLE 20261031202921` a été créée avec trois utilisateurs : administrateur, opérateur et lecture seule. L’inscription, les invitations, les changements de rôle, les factures, les règlements, les avoirs, les mouvements de trésorerie, les journaux, les compteurs, les exports, l’échéance et la récupération de compte ont été exercés sur la vraie base. Le contrôle final en lecture seule passe **312 vérifications**. [Preuve finale](company-final-readonly.json)

| État financier final de l’entreprise fictive | MAD |
| --- | ---: |
| Banque | 24,00 |
| Caisse de recette, désormais archivée | 0,00 |
| Facture client ouverte | 240,00 |
| Avoir client disponible, non affecté en fin de recette | 24,00 |
| Créance client nette, après crédit disponible | 216,00 |
| Dette fournisseur restante | 0,00 |
| Encaissements clients réels | 240,00 |
| Décaissements fournisseurs réels | 216,00 |
| Transferts internes, dans chaque sens | 20,00 |
| Total entrées de trésorerie, transferts inclus | 260,00 |
| Total sorties de trésorerie, transferts inclus | 236,00 |
| Débit cumulé des 11 écritures comptabilisées | 1 229,00 |
| Crédit cumulé des 11 écritures comptabilisées | 1 229,00 |

Les journaux se répartissent en VE : 3 écritures et 504 MAD ; AC : 3 et 264 MAD ; BQ : 4 et 456 MAD ; OD : 1 et 5 MAD. Chaque écriture est équilibrée. Les quatre règlements disposent chacun de leur mouvement et de leur propre écriture ; aucune source en attente ne reste dans ce scénario. Le disponible de l’avoir client explique la différence entre le solde de facture de 240 MAD et la créance nette de 216 MAD. [Détail et rapprochement](company-final-readonly.json)

## Portée des preuves

Les scripts utilisent les vraies fonctions de l’application, les sessions Supabase publiques des trois comptes et la base réelle. Leur adaptateur fournit le contexte de requête/cookies et les frontières de navigation/cache de Next.js. Ce sont des essais d’authentification, d’actions serveur, d’API et de RLS ; ils ne prouvent pas à eux seuls que chaque formulaire a été parcouru dans le navigateur.

Les écritures de recette sont limitées à cette entreprise fictive. Les comptes utilisent les alias de la boîte autorisée par l’utilisateur. Le manifeste privé, les mots de passe, les liens d’invitation et les vérificateurs PKCE restent hors du dépôt. Aucune donnée d’une entreprise cliente n’a été corrigée ou supprimée.

## Corrections de l’audit

| Besoin essentiel | Comportement livré |
| --- | --- |
| Factures et journaux fiables | Enregistrement atomique, références d’entreprise contrôlées, lignes et totaux recalculés, numéro préservé à la modification d’un brouillon. |
| Corrections après comptabilisation | Montants et annulation verrouillés ; affectation/retrait de règlements et d’avoirs préservant le cash et le journal. L’opérateur peut réaffecter un avoir comptabilisé. |
| Avoirs clients et fournisseurs | Brouillon modifiable, validation, affectation, retrait, comptabilisation administrateur, historique et impression. Référence fournisseur et compteur interne distincts. |
| Trésorerie | MAD pour les nouvelles opérations Essentiel ; mouvement manuel et archivage atomique ; transfert corrigé par un transfert inverse conservant les deux paires dans l’historique. |
| Historique et exports | Pagination, recherche et filtres, CSV exhaustifs ; consultation reliée à l’écriture du règlement concerné. |
| Contacts et catalogue | Archives retrouvables et restaurables ; catalogue facultatif, lignes libres conservées. |
| Équipe et droits | Administrateur/opérateur/lecture seule, effets immédiats d’une désactivation ou d’un changement de rôle, dernier administrateur protégé, quota vérifié avant SMTP. Les API remontent un échec d’écriture. |
| Abonnement | Lecture sans création implicite d’essai, échéance effective requise pour écrire, consultation et exports conservés après expiration. |
| Compte perdu | Demande email, callback PKCE, preuve courte liée au compte et changement de mot de passe sécurisé. |
| Interface | Actions masquées selon rôle et échéance, explication de l’envoi manuel des factures, assistance accessible. La fiche tiers et les pièces jointes conservent leur lecture sans afficher les actions interdites. Les taux TVA des lignes libres sont imprimés même sans référence au catalogue TVA. |
| Exploitation | Santé réelle de la base, cron fermé en l’absence de secret, vérifications automatisées et procédure de reprise. |

Le stock et les fonctions avancées restent sur demande.

## SQL appliqué et sauvegarde source

Le bundle transactionnel **098–101 a été appliqué manuellement** dans le projet Felexia. L’utilisateur a confirmé les quatre indicateurs et les nouveaux contrats ont été retrouvés via PostgREST. La nouvelle recette réelle utilise ces protections ; il n’y a plus d’étape SQL en attente pour ce lot.

Fichier : `supabase/essential-launch-098-101.sql`. SHA256 : `e22e2c3380f757a20fd59a0faf11ca5a726236c3843db748291a565f13f553e2`. Le bundle ne renumérote pas les documents et ne réécrit pas les montants historiques. [Manifeste des migrations et empreintes](sql-release.json), [installation native de contrôle](native-final-migrations.json)

Sauvegarde source préalable : `codex/backup-before-essential-fixes-20261031`, commit `6c91fc8`, bundle vérifié `../backups/felexia-before-essential-fixes-20261031.bundle`. La restauration locale du schéma et de 81 tables synthétiques a été vérifiée ; elle ne couvre pas la sauvegarde du projet Supabase hébergé ni les fichiers Storage. [Preuve de restauration locale](restoration.json), [procédures d’exploitation](../../../docs/OPERATIONS.md)

## Recette réelle à trois utilisateurs

Tous les passages finaux ci-dessous sont réussis. Les nombres désignent les assertions de chaque script, dont certaines vérifications communes de session et d’entreprise ; ils ne représentent pas un nombre de parcours utilisateur distincts.

| Étape réelle | Contrôles réussis | Preuve |
| --- | ---: | --- |
| Inscription, entreprise et données initiales | 15 | [prepare](company-prepare.json) |
| Deux invitations | 8 | [invite](company-invite.json) |
| Renvoi des invitations | 10 | [resend](company-resend.json) |
| Activation des deux équipiers | 15 | [accept](company-accept.json) |
| Ventes, achats, règlements et premières écritures | 43 | [business](company-business.json) |
| Refus par rôle, entreprise et devise | 36 | [boundaries](company-boundaries.json) |
| Désactivation/réactivation, rôles immédiats, dernier administrateur, quatrième utilisateur refusé avant SMTP | 41 | [team](company-team.json) |
| Mouvement manuel, archivage, transferts inverses et idempotence | 52 | [treasury](company-treasury.json) |
| Archives, avoir client, 26 brouillons supplémentaires, pagination, CSV, compteur corrigé/restauré et OD | 136 | [corrections](company-corrections.json) |
| Avoir fournisseur, retrait/réaffectation après comptabilisation, solde par avoir et paiement | 46 | [supplier-credit](company-supplier-credit.json) |
| Simulation contrôlée d’expiration, trois rôles, consultation et exports ; état restauré | 96 | [expiry](company-expiry.json), `restored: true` |
| Récupération : demande email puis changement effectif du mot de passe | 6 + 24 | [recovery](company-recovery.json) |
| Comptabilisation de la dernière facture de recette | 4 | [finalize](company-finalize.json) |
| Annulation et archivage de la facture temporaire créée dans le navigateur | 5 | [browser-cleanup](company-browser-cleanup.json) |
| Rapprochement final, sources, finances, droits et trois lectures identiques | 312 | [final-readonly](company-final-readonly.json) |

La simulation d’échéance modifie temporairement un état serveur de cette seule entreprise de recette, puis le restaure. Elle utilise les vraies actions, les exports et les restrictions PostgreSQL ; elle ne produit aucun paiement Stripe. [Portée exacte de la simulation](company-expiry.json)

La réception de **quatre invitations et de deux emails de récupération** a été vérifiée dans la boîte autorisée. La quatrième invitation de quota n’a entraîné aucun appel SMTP. Les messages observés sont encore présentés comme provenant de **Supabase Auth / Postmark** : la déclaration de configuration Gmail ne permet pas d’affirmer que le SMTP Gmail les a transportés. Les adresses et liens privés ne sont pas reproduits dans ce rapport.

Les premiers essais ont révélé trois problèmes de recette repris avant les passages finaux : pays fourni sous le libellé `Maroc` alors que l’action attend `MA`, nom d’unité absent d’une facture fournisseur, et vérificateur PKCE écrasé par des exécutions concurrentes du harness. Les données valides ont été reprises dans l’entreprise fictive et les contrôles finaux ont réussi. Les tentatives échouées restent identifiées comme telles. [Essai unité](company-business-attempt-unit.json), [essai récupération](company-recovery-attempt-state.json)

## HTTP public et navigateur

Le passage HTTP utilise trois jeux de cookies SSR indépendants obtenus par SDK, puis les vraies routes publiques. Le résultat consolidé est **554/554 assertions réussies**. Il couvre 141 réponses de pages, dont 42 aperçus imprimables, 18 CSV, 21 exports filtrés et 12 exports Excel de journaux. Les 83 vérifications de permissions ont été réexaminées dans un passage séparé ; elles ne sont pas à additionner aux 554 assertions consolidées. [Rapport HTTP final](company-http-final.json), [permissions](company-http-permissions.json)

Trois contrôles initiaux attendaient un statut de refus pour un compte bancaire d’une autre entreprise fictive. Le serveur renvoie une page 200 « Compte introuvable » ; ces cas ont été revalidés sur le contenu et l’absence de données étrangères, puis documentés dans le rapport final. Le scénario HTTP ne dispose pas de notes internes non vides dans ces sources imprimables : il vérifie l’absence de leur section, tandis que les fixtures d’impression exercent explicitement des notes non vides.

Les **20/20 contrôles observés dans le vrai navigateur public réussissent**, avec les trois profils autorisés. Ce passage est distinct du harness SDK et du contrôle HTTP. [Preuve navigateur](company-browser.json)

- [x] Client créé en ne saisissant que son nom, puis archivé et restauré.
- [x] Connexion opérateur et menu léger sur le domaine public.
- [x] Téléchargement réel d’un CSV contenant trois contacts : [contacts-browser.csv](contacts-browser.csv).
- [x] Facture de vente de 120 MAD créée, validée puis marquée envoyée avec les contrôles de l’interface. Son annulation et son archivage ont ensuite réussi par SDK, 5/5 vérifications, pour conserver les soldes de recette : [nettoyage](company-browser-cleanup.json).
- [x] Tableau de bord du lecteur sans création rapide ; fiche tiers sans formulaires de mutation, contacts et adresses lisibles ; facture ouverte de 240 MAD accessible avec impression seule.
- [x] Déconnexion du lecteur par `/auth/logout` : retour effectif à la connexion ; connexion administrateur réussie avec le mot de passe récupéré.
- [x] Taux « 20 % » confirmé sur les impressions publiques vente et achat sans référence de catalogue TVA.
- [x] Vue mobile de 390 px sans débordement horizontal, message d’accueil d’essai masquable, menu léger à six entrées ouvrable et fermable ; retour au bureau 1 280 px sans débordement.

Captures du passage réel : [tableau de bord bureau](dashboard-desktop.jpg), [tableau de bord mobile](dashboard-mobile.jpg), [accueil d’essai mobile](dashboard-mobile-welcome.jpg), [menu mobile](menu-mobile.jpg). Le CSV téléchargé dans le navigateur contient trois contacts et le client créé pendant ce passage.

La navigation complète des formulaires d’inscription, d’acceptation d’invitation et de récupération ne doit pas être déduite des seuls essais SDK. Leur authentification et leurs actions réelles sont vérifiées ci-dessus.

Le correctif des taux TVA est publié dans `e8568da` ; ses 10 fixtures SSR couvrent notamment 20 %, 0 % et un libellé d’exonération sans clé TVA. La déconnexion du lecteur pouvait être refusée par la garde des écritures financières : la route personnelle `/auth/logout`, avec contrôle d’origine et suppression des cookies, corrige ce défaut dans `3970b91`. Ses 34 contrôles isolés passent ; la déconnexion réelle du lecteur et la reconnexion administrateur ont ensuite été observées sur ce déploiement. [Tests de déconnexion](logout-route-tests.json)

## Préparation Checkout réelle sans paiement

**94/94 contrôles réussissent** sur les routes Checkout de production et la lecture de leurs sessions Stripe. Le mensuel est à 290 MAD et l’annuel à 2 900 MAD. Deux demandes mensuelles réutilisent la même session ; passer à l’annuel expire la précédente. Le passage final prépare deux sessions distinctes ; en comptant le premier essai, les trois sessions enregistrées ont toutes été expirées. Aucun formulaire Checkout n’a été confirmé, aucun fonds débité, aucun abonnement payant créé et les dates de l’essai local sont inchangées. [Preuve Checkout et nettoyage](company-billing-checkout.json)

Le premier essai Checkout a été repris car le harness attendait l’hôte `www` alors que le retour HTTPS canonique valide utilise `felexia.pro`. Sa session a été expirée ; ce passage et sa cause restent dans la preuve finale.

La configuration Stripe réelle a été lue sans écriture : endpoint activé, API `2020-08-27`, événement `invoice.payment_succeeded`. L’application accepte maintenant cet événement payé en plus de `invoice.paid` ; les 27 fixtures du handler passent. Une requête webhook non signée est refusée en 400. Aucun événement de paiement réel n’a été généré. [Configuration et refus sans signature](stripe-webhook-configuration.json), [fixtures du handler](webhook-recovery-tests.json)

## Contrôles isolés et exploitation

| Vérification complémentaire | Résultat et preuve |
| --- | --- |
| Intégrité financière, deux modes RLS | 49 par mode : [strict](finance-strict.json), [relâché](finance-relaxed.json) |
| Avoir client, trois configurations PostgreSQL | 43 chacune : [natif](credit-native.json), [strict](credit-strict.json), [relâché](credit-relaxed.json) |
| Avoir fournisseur et courses d’affectation/paiement | 50 par configuration : [natif](supplier-credit-native.json), [strict](supplier-credit-strict.json), [relâché](supplier-credit-relaxed.json) ; [concurrence](supplier-credit-concurrency.json) |
| Finances concurrentes en PostgreSQL natif | [20 contrôles](native-finance-concurrency.json) |
| Abonnement et quota, deux modes RLS | 51 par mode : [strict](subscription-postgres-strict.json), [relâché](subscription-postgres-relaxed.json) |
| Lecture d’abonnement sans bootstrap | [144 contrôles](read-subscription-guards.json) |
| Routes checkout/portail et handlers Stripe | [24 contrôles](checkout-fixture-tests.json), [27 contrôles](webhook-recovery-tests.json) ; fixtures sans achat réel |
| Récupération et restauration après pannes simulées | [26 contrôles](recovery-action-tests.json), [12 scénarios](expiry-harness-tests.json) |
| Routes d’équipe et refus avant SMTP | [55 contrôles](team-handlers.json) |
| Déconnexion, origine et cookies pour tous les rôles | [34 contrôles](logout-route-tests.json) |
| Middleware rôle/échéance/export | [17 contrôles](middleware-access-tests.json) |
| Pagination et services, limite API artificielle de 37 lignes | [30 contrôles](workflow-services.json) |
| Impression d’avoir fournisseur, données synthétiques | [14 contrôles SSR](supplier-credit-print-tests.json) |
| Santé réelle DB et cron sans secret/mauvais secret | [4 contrôles](operations.json) |

Le déploiement Vercel de `3970b91` a réussi. Les workflows de vérification [main 41244615530](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41244615530) et [branche de correction 41244629030](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41244629030) sont verts. Le build, le typage, le lint et les régressions ont réussi. Les dépendances de production ne présentent pas d’alerte dans l’audit npm réalisé ; les outils de développement restent distincts. Le premier passage Linux a corrigé un test de frontière mensuelle lié aux règles IANA de Casablanca, avec Node.js 22 à jour et sans décalage horaire fixe dans l’application.

## Limites et actions externes restantes

- **SMTP public** : réception confirmée sur les alias autorisés, mais transport Gmail non établi. Confirmer le prestataire effectivement utilisé, l’expéditeur et la capacité d’envoi pour le lancement.
- **Paiement Stripe** : préparation réelle des sessions Checkout et nettoyage vérifiés, compte/prix/configuration webhook lus. Aucun achat, débit bancaire ni cycle de paiement puis webhook signé complet n’a été exécuté. Les cas de paiement du handler restent des fixtures. [Lecture Stripe sans écriture](stripe-readonly.json), [Checkout réel sans paiement](company-billing-checkout.json)
- **Cron et supervision** : la santé de production répond 200 avec base disponible, mais le cron sans authentification répond 503 et confirme que `CRON_SECRET` est absent en production. Son ajout manuel a été demandé et reste à confirmer ; aucun secret n’a été créé ni copié dans le dépôt. La planification et la surveillance restent à vérifier après configuration. [Contrôle de production](operations-production.json)
- **Sauvegarde hébergée** : la restauration locale de 81 tables synthétiques réussit. Une restauration Supabase cloud et la récupération des octets Storage restent à vérifier.
- **Identité légale et inscription** : informations réelles de l’éditeur encore à fournir ; aucune identité ou référence légale n’a été inventée. Le projet auto-confirme actuellement les inscriptions ; son réglage doit correspondre au choix de lancement.
- **Ancien abonnement** : le préflight trouve un abonnement `active` sans échéance. Il n’a pas été réécrit. Sa date réelle doit être régularisée par l’administrateur ; la règle stricte refuse sinon les nouvelles écritures. [Préflight en lecture seule](deployment-preflight.json)

Les opérations essentielles réelles, les trois profils et les parcours d’interface observés sont vérifiés sur la version publiée. Les points externes ci-dessus restent distincts de cette validation ; le secret cron de production est le réglage encore explicitement absent.
