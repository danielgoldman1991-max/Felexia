# Correctifs prévisions et facturation — 1er novembre 2026

Lot local uniquement, aucun SQL, paiement, email, changement d'environnement ou déploiement.

## Comportement corrigé

- **P02 :** la prévision calcule uniquement en MAD. Les comptes et factures étrangers sont exclus, ainsi que les prévisions manuelles liées à un compte hors MAD ou introuvable. Les exclusions sont comptées et affichées dans une alerte. Écran, impression et export indiquent le périmètre et l'absence de conversion. Un compte EUR sélectionné est refusé explicitement. Les prévisions manuelles sans compte sont considérées comme MAD, ce qui est annoncé.
- **P03 :** comptes, factures clients/fournisseurs et prévisions manuelles passent par `readAllPages`, triés par ID et filtrés par entreprise à chaque page. Le filtre de compte réutilise cette lecture complète des comptes MAD actifs, sans seconde liste limitée à la première page. Une erreur, même tardive ou une table manuelle absente, empêche l'affichage/export de totaux partiels. Les périodes impossibles, inversées ou supérieures à 367 jours et les paramètres de scénario/sens invalides sont refusés avant la lecture. Les jours restent calculés en UTC. La consolidation quotidienne utilise un index par date.
- **P06 :** les noms de clients/fournisseurs sont lus dans la relation réellement retournée, objet ou tableau, et conservés dans l'impression/export. Le CSV utilise l'encodeur partagé contre les formules de tableur et comporte des colonnes MAD et un rappel du périmètre.
- **S05 :** le diagnostic de production reconnaît la clé Supabase moderne ou legacy via le résolveur de l'application et ne prétend plus que la clé legacy absente est présente. Aucune valeur de clé n'est imprimée.
- **S07 :** Checkout et portail exigent une origine navigateur reconnue après authentification/rôle, avant tout appel DB/Stripe. Les origines exactes du domaine demandé et du domaine configuré permettent apex/www/preview. Ils partagent une limite de 10 requêtes/minute et 60/heure par entreprise, avec 429 et Retry-After. Cette limite est locale au processus, en complément du lease SQL existant, et ne constitue pas un quota distribué.

Le message de portail sans abonnement dirige vers ESSENTIEL ou vers un devis PRO. Aucun prix PRO ni achat direct PRO n'a été ajouté.

## Validation fraîche

| Preuve | Résultat | Frontières |
|---|---:|---|
| `forecast-fixtures.json` | 60 assertions | Modules réels, DB synthétique tenant/pagination, 1601 lignes dans chacune des quatre sources et dans le filtre de compte, EUR/MAD, erreur tardive, UTC/Casablanca/New York, noms tiers et CSV hostile, rendu React réel de l'impression avec échappement HTML |
| `billing-security-fixtures.json` | 41 assertions | Politique et deux handlers réels, Auth/DB/Stripe/horloge synthétiques, refus avant effets externes |
| `public-config-fixtures.json` | 4 scénarios | Script réel dans des processus enfants, URLs/clés publiques fictives : moderne, legacy, les deux, aucune |
| `billing-fixtures.json` | 96 contrôles | Régression offres/Stripe avec politique de requête admise en frontière synthétique |
| `checkout-fixture-tests.json` | 24 contrôles | Régression des handlers, rôle/lease/client Stripe et reprise, sans réseau |
| `domain-fixtures.json` | 45 assertions | Régression prévisions, calculs commerciaux et export fiscal préparatoire |
| ESLint ciblé sur les neuf fichiers produit modifiés | Réussi | Aucun build ou typage global lancé pendant les éditions des autres agents |

Les trois harness historiques ont été adaptés à la nouvelle frontière de requête ou à la pagination. Les rapports JSON historiques ont été conservés : `run-regression.cjs` redirige uniquement les nouvelles preuves vers ce dossier. Les suites propres à ce lot testent réellement les nouveaux refus d'origine et la limite, sans admettre cette frontière.

Guides Next locaux lus avant édition : `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` et `03-layouts-and-pages.md`. Checklist `react-best-practices` appliquée : lectures indépendantes parallèles, aucun hook ajouté, message d'échec accessible via `role=alert`, avertissement monétaire visible à l'écran et en impression, index pour les recherches répétées, aucune nouvelle dépendance/client effect.

## Limites

Pas de conversion multi-devises fournie : le résultat est volontairement une prévision MAD. La pagination ordonnée évite la limite de première page, mais ne constitue pas un snapshot transactionnel entre des écritures concurrentes. Le choix de compte filtre le solde et les prévisions manuelles ; les factures ouvertes de l'entreprise restent des flux sans affectation bancaire, comme auparavant. Pas de recette navigateur ni de contrôle hébergé des nouveaux correctifs dans ce lot. Build/typage et recette consolidée restent à exécuter par l'agent principal après intégration.
