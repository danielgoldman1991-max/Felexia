# ESSENTIEL et PRO — 1 novembre 2026

## Offre et sauvegarde

Demande : reprendre l’ERP complet sauvegardé le 31 octobre comme offre PRO et présenter ESSENTIEL et PRO sur le site. Tarif PRO confirmé par l’utilisateur : 1 290 MAD/mois ou 12 900 MAD/an. ESSENTIEL reste à 290/2 900 MAD. L’essai gratuit reste l’essai ESSENTIEL d’un mois ; aucun essai PRO ni changement d’abonnement automatique.

Base `f998b0b`, branche `codex/essential-pro-offers-20261101`. Sauvegarde préalable `codex/backup-before-pro-offer-20261101` et bundle vérifié `../backups/felexia-before-pro-offer-20261101.bundle`. La sauvegarde ERP complète est `codex/backup-erp-complet-20261031` à `c6fd5c3`. Ses modules métier sont toujours dans la source actuelle : aucune restauration massive d’ancien code n’est nécessaire.

## Réalisation

- PRO réutilise le code durable `premium`, ses références Stripe, 25 utilisateurs et le quota documentaire sans plafond mensuel. Le libellé public est PRO, l’alias explicite `pro` est accepté, Business reste masqué et non achetable. Les abonnements existants sont conservés.
- L’accès complet découle du plan de l’entreprise authentifiée. Les overrides serveur historiques restent disponibles pour la présentation ; ils ne remplacent pas le plan dans les protections SQL. Après échéance, PRO conserve la lecture ; ses mutations sont bloquées.
- Deux cartes tarifaires sur accueil et `/pricing`, choix mensuel/annuel, section ERP complet à six familles, FAQ, liens, métadonnées et CG cohérents. L’image et le contrôleur de zoom restent identiques.
- Le choix PRO/période traverse connexion, inscription email/Google, confirmation et création d’entreprise. Les destinations sont internes et vérifiées ; aucun abonnement PRO n’est créé à l’inscription.
- Gardes serveur avant effets pour les modules avancés, uploads, corrections TVA et stock ; contrôles par rôle et échéance ; boutons indisponibles masqués sur les principaux écrans avancés et RH. Le catalogue ESSENTIEL simple et les documents financiers courants sont conservés. Les nouveaux comptes/règlements restent en MAD, conformément aux protections déjà appliquées.

## Base et Stripe

Migration104 appliquée manuellement par l’utilisateur, puis vérifiée par Auth public : capacité `{workflow_version:104,pro_write_guards:true}`, refus anonyme/nonmembre et lectures conservées. SHA256 `761fae996972488b18e8360c21d2135eccde986a86ef0b721d264f2705d0438a`. Détail et limites dans [SQL-AUDIT.md](SQL-AUDIT.md). Aucun abonnement ou enregistrement métier modifié lors de ces vérifications ; empreintes financières QA identiques. Rollback manuel disponible, sans suppression de données.

Les quatre prix Stripe live sont actifs et correspondent aux montants/devise/périodicités attendus. Produit complet renommé `Felexia PRO`. Portail dédié `bpc_1UWunCA1UYDHtMFwTM11tk75` : exactement deux produits et quatre prix, changements à confirmer par le client, annulation en fin de période, historique et moyens de paiement. Variable Production `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` configurée. État de retour arrière privé dans `../backups/felexia-pro-billing-20261101.json`. Aucun client, paiement ou abonnement Stripe créé par le provisionnement.

La première vérification du provisionnement a révélé que Stripe omet les produits du portail sans `expand`. Le script a été corrigé pour demander les collections, puis le produit et les quatre prix ont été relus et vérifiés. Aucun second portail n’a été créé. Les fixtures reproduisent désormais cette omission.

Références utilisées : [objet Price Stripe](https://docs.stripe.com/api/prices/object), [configuration du portail](https://docs.stripe.com/api/customer_portal/configurations/create). L’API de checkout valide le prix avant toute mutation Stripe et refuse PRO si la capacité104 n’est pas présente.

## Vérifications avant publication

- Typage, ESLint global `src`, build optimisé réussis ; journal `build.log`.
- SQL réel jetable : 44 assertions strictes et 44 assouplies, incluant droits, échéance, stockage et retrait/réinstallation104.
- Fixtures comportementales : accès/actions/middleware177, facturation88, provisionnement16, continuation inscription54, lecture seule UI92 et RH37. Frontières Auth/DB/Stripe simulées pour ces séries, sans réseau ni secrets.
- Régressions existantes : version ESSENTIEL, électronique, récupération26, checkout24, webhook31, accès middleware17 et contrôleur de zoom100 réussis. Ces séries se recouvrent et ne sont pas additionnées.
- Hébergé après SQL : 21 contrôles en lecture seule, capacité et finances QA inchangées (`production-readonly.json`).
- Build local optimisé3112 : 23 contrôles HTTP publics (`local-public.json`), deux offres, liens PRO, retour connexion avec période, anonyme401 et image SHA identique.
- Navigateur local : cartes lisibles en1280×900 et390×844, aucun débordement horizontal observé, tarifs annuels2 900/12 900 et lienPRO annuel correct, connexion avec choix conservé. L’émulation de viewport ne certifie pas tous les moteurs.

## Publication et recette réelle

Code `ef63a4899f08ff3982fc55adef1675153842a2c4` publié en fast-forward sur `main`. Le connecteur GitHub a été utilisé car le terminal ne disposait pas d’identifiants Git. L’arbre distant a été comparé à l’index local avant synchronisation : contenu identique. La CI de branche [41292828139](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41292828139) est entièrement réussie. Un ancien test isolé de déconnexion a été adapté au nouveau helper de continuation après sa première détection en CI ; les assertions de déconnexion restent inchangées.

Production Git `dpl_Hyw5kkWEvccCDJV967UDpf13g3nb` READY, reconstruction avec l’environnement Production, domaines `www.felexia.pro` et `felexia.pro` assignés, construction58 661ms. Aucun build local ni variable publique de recette envoyé. Le déploiement manuel identique `dpl_J6e6MJykLPRfCqwGyEH3gcPqw1xi`, resté en file derrière le déploiement Git automatique, a été annulé pour éviter une reconstruction redondante. Ancienne production `dpl_6jVzFNVVo3TPgEAV1Mp5uAW99mRH` conservée ; branche distante `codex/backup-production-before-pro-20261101` à `b078654`.

- Domaine public : 23 contrôles HTTP réussis (`production-public.json`), deux offres, six familles PRO, pages légales, image conservée, choix annuel préservé vers connexion, anonyme401.
- Navigateur public : tarifs annuels2 900/12 900MAD, lien PRO avec `billing=yearly`, absence de débordement observée en1280×900. Les observations locales sont dans `browser-local.json`.
- Checkout réel de l’entreprise synthétique autorisée : 100/100 contrôles (`production-checkout.json`). PRO mensuel1290 et annuel12900MAD, métadonnée durablepremium, réutilisation de la session mensuelle, ancienne session expirée lors du changement de cycle ; deux sessions préparées et toutes expirées à la fin. Opérateur/lecteur403, Business400.
- Aucun Checkout ouvert dans un navigateur, aucune carte, aucun paiement, aucun abonnement Stripe créé. Les échéances et champs de l’essai ESSENTIEL de recette restent identiques ; empreintes des données financières également identiques. Identifiants privés et URLs Checkout conservés uniquement dans le journal privé hors dépôt.

L’aperçu optimisé local reste disponible sur3112 ; le serveur de développement3111 a été arrêté. La [CI main41293088732](https://github.com/danielgoldman1991-max/Felexia/actions/runs/41293088732) est également entièrement réussie, y compris build et tracing. État final dans `release.json`.

Les fonctions TVA et paie restent préparatoires. Ce lot ne configure aucune transmission DGI, signature qualifiée ou paie certifiée.
