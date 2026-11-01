# Audit fonctionnel de l’ERP complet PRO — 1er novembre 2026

L’accès PRO ouvre les modules de l’ERP complet sauvegardé. L’audit confirme des opérations réelles de stock, livraison, retour, réception fournisseur et rapprochement bancaire dans une base jetable. Il met aussi en évidence des sous-menus encore réservés, des écrans RH de consultation et des fonctions fiscales/sociales préparatoires. **L’ouverture de tous les menus ne signifie donc pas que chaque fonction annoncée dans ces menus est finalisée.**

Les tarifs « sur devis », l’activation du compte propriétaire, la publication et les contrôles hébergés sont suivis dans le rapport principal de la même livraison. Ce document détaille les preuves fonctionnelles isolées et les lacunes du périmètre complet ; il ne remplace pas ce rapport de publication.

## Périmètre et nature des preuves

| Preuve | Résultat | Ce qu’elle démontre | Limite |
|---|---:|---|---|
| Inventaire AST des pages/routes | 250 pages, 33 handlers | Présence des routes, composants, liens et actions directes | Une route présente n’est pas un test fonctionnel réussi |
| Inventaire des modules `use server` | 223 exports dans 41 fichiers | Catalogue des fonctions, tables/RPC et gardes nommées directement | Les appels indirects et toutes les permissions ne sont pas analysés automatiquement |
| SQL avancé, PGlite strict | 45 contrôles réussis | Vraies migrations/RPC, mutations et refus de stock/banque/RH/GED/TVA | Auth/REST Supabase et navigateur absents |
| Même SQL, configuration assouplie | 45 contrôles réussis | Compatibilité du même scénario dans la seconde configuration | Réexécution des mêmes cas, pas 45 scénarios métier supplémentaires |
| Actions RH et moteur de paie réels | 55 assertions réussies | Calculs, erreurs, états finalisés, écriture groupée et validation de période | Client Supabase, session et contexte Next contrôlés ; pas un cycle de paie hébergé |
| Fonctions métier/export réelles | 45 assertions réussies | Dates, prévisions, scénarios, remises/TVA et sérialisation XML/CSV | Données API synthétiques ; pas de dépôt fiscal ni de paiement |
| Lint des cinq scripts de cet audit | Réussi | Scripts exécutables sans erreur ESLint | Vérification statique |

Les scénarios SQL chargent les vraies migrations du dépôt, dont la migration 104 déjà appliquée manuellement par l’utilisateur. Ils reprennent le bootstrap documenté de la recette Essentiel ; celui-ci fournit des tables comptables historiques minimales dont la migration de création n’est pas présente dans le dépôt. Cette base isolée fournit donc une preuve des fonctions testées, pas une reproduction intégrale de Supabase hébergé. Les schémas Auth et Storage nécessaires au bootstrap sont simulés. Aucune nouvelle migration n’est fournie ni appliquée par cet audit.

Les données métier SQL de cet audit sont synthétiques, insérées dans une transaction puis annulées. Le dernier contrôle vérifie leur disparition. Les scripts n’utilisent ni `.env`, ni clé de service de production, ni accès réseau. Aucun compte utilisateur réel n’est modifié par ces scripts ; aucun email, paiement ou envoi DGI n’est déclenché. Les scripts historiques de stress qui chargent une clé de production n’ont pas été exécutés.

Les contrôles HTTP réels du compte autorisé sont enregistrés séparément dans [host-owner-readonly.json](./host-owner-readonly.json). Leur couverture et leur résultat définitif doivent être lus dans le rapport principal. Ils portent sur des GET autorisés en lecture, sans soumission des formulaires. Les GET pouvant créer un compte bancaire, initialiser des référentiels ou enregistrer un téléchargement fiscal ont été exclus de cette phase en lecture seule.

## Résultats par module

| Module | État observé | Preuve nouvelle de cet audit | Ce qui reste à distinguer |
|---|---|---|---|
| Tableau de bord et guide | Composants et accès existants | Inventaire source ; lecture hébergée suivie séparément | Pas de nouvelle mutation de données utilisateur |
| Tiers et articles | Listes, fiches et formulaires existants | Produit stockable/service et séparation entreprise testés dans les opérations SQL ; unités indivisibles testées en TypeScript | Les parcours complets de chaque formulaire ne sont pas rejoués dans cet audit isolé |
| Ventes : devis, commandes, livraisons, retours | Parcours présent ; impacts stock vérifiés | Remise/TVA exactes sur cas témoin ; commande liée à devis ; livraison partielle, retour, statuts et idempotence en SQL réel | Le devis et la commande sont créés comme données de départ SQL ; conversion par formulaire non testée ici |
| Factures, avoirs, règlements, relances clients | Implémentations canoniques sous `/facturation` | Inventaire ; montants des factures utilisés pour les prévisions | Les anciennes routes `/factures/new` et `/factures/[id]` sont des maquettes et ne remplacent pas les routes canoniques |
| Achats et réceptions fournisseur | Parcours présent ; réception stock vérifiée | Réception de 3 unités, commande reçue, finalisation et refus du doublon en SQL réel | Les cycles facture/avoir/paiement fournisseur ont leurs recettes antérieures distinctes ; ils ne sont pas présentés comme nouvellement exécutés ici |
| Stock et emplacements | Entrées, sorties, mouvements et emplacements implémentés | Quantités, transfert entre deux dépôts, conservation du total, refus du stock insuffisant, transaction annulée si deuxième mouvement invalide | `/stock/inventaire` reste réservé ; cela ne supprime pas les écrans d’entrée ou d’ajustement existants |
| Trésorerie et rapprochement | Opérations et consultation implémentées | Ligne de relevé +100 puis frais −25 : solde 75 ; répétition sans double mouvement ; ligne ignorée refusée | Import de fichier bancaire et formulaire complet non rejoués ici |
| Prévisions de trésorerie | Calcul métier vérifié et corrigé | Trois fuseaux ; soldes journaliers 1 100 → 1 050 → 1 025 ; scénarios prudent/optimiste ; échec de lecture des comptes refusé | Ce sont des prévisions selon les données et hypothèses, pas un engagement de solde futur |
| Comptabilité générale | Vrais écrans de journaux, écritures, balance, grand livre et comptes présents | Inventaire source ; recettes comptables antérieures séparées | La page centrale `/comptabilite/exports` est descriptive ; les vrais exports journal et plan comptable sont sur leurs routes dédiées |
| TVA | Déclarations et exports préparatoires présents | Déclaration SQL créée ; calcul base/taxe et soldes ; identifiants requis ; XML échappé et CSV Unicode | Aucun dépôt DGI ni homologation ; les taux et montants d’essai ne constituent pas une validation fiscale du dossier réel |
| Facturation électronique | Parcours documentaire présent | Inventaire source ; recettes documentaires antérieures séparées | Émission/archives documentaires et connexion officielle DGI sont deux capacités distinctes ; pas de transmission/signature officielle testée ici |
| GED | Bibliothèque, import de fichier, export et téléchargement présents | Enregistrement documentaire SQL archivé | Téléversement Storage hébergé non rejoué ; Archives/Modèles/Pièces jointes ont encore des pages réservées dédiées |
| RH salariés et contrats | Création/modification salariés et création/liste contrats présentes | Nom salarié généré, contrat persisté en SQL | Le détail contrat affiche seulement son identifiant et une notice ; dix autres écrans RH sont des consultations |
| RH congés | Stockage et action serveur présents | Demande SQL persistée au statut `pending` | Pas de formulaire de création/approbation dans la page Congés actuelle |
| Paie, CNSS/AMO et IR | Préparatoires | Moteur réel + actions RH, 55 assertions | Pas de certification sociale/fiscale, de clôture officielle ou de déclaration transmise ; atomicité complète encore à prévoir |
| Agenda, outils, rapports avancés | Écrans réservés | Inspection source de chaque route | Ne pas les présenter comme des workflows utilisables |
| Paramètres, équipe et abonnement | Écrans existants ; commercialisation modifiée par les autres lots | Inventaire source ; tests d’accès/facturation suivis dans le rapport principal | Cet audit isolé ne crée pas d’utilisateur, invitation ou abonnement réel |

La [matrice exhaustive](./ROUTE-MATRIX.md) contient chacune des 283 entrées avec son état. L’[inventaire des actions](./ACTIONS.md) répertorie les 223 exports serveur. Les catégories source actuelles sont : 210 « implémentation présente », 14 redirections, 20 écrans réservés, 5 écrans descriptifs, 2 maquettes anciennes, 22 routes préparatoires et 10 consultations RH. Elles ne sont pas des pourcentages de validation fonctionnelle.

## Anomalies corrigées dans cette livraison

### Paie : refus et propagation des erreurs

La préparation d’une paie vérifie désormais les quatre lectures nécessaires avant toute écriture : période, salariés, paramètres et bulletins existants. Une période validée/payée/archivée, un bulletin finalisé, un ancien salarié encore présent dans les bulletins ou un salaire de base invalide provoque un refus explicite. Les salariés archivés sont exclus du calcul. La création d’une période valide également le mois et l’année, et refuse de continuer si la recherche d’une période existante échoue.

Les bulletins calculés sont enregistrés par un seul `upsert` groupé. L’échec de cette requête ne peut plus être suivi d’une période déclarée calculée. La requête finale de période revérifie son état modifiable et contrôle le résultat ; une erreur ou une modification concurrente refusée ne produit plus un retour de succès. Les tests incluent les échecs de lecture, du lot et de la requête finale.

**Limite résiduelle prouvée par test :** le lot de bulletins et la mise à jour de période restent deux requêtes. Si la seconde échoue, le lot déjà enregistré peut subsister avec des totaux de période anciens. Une finalisation concurrente entre les deux requêtes reste aussi à traiter. L’application remonte maintenant une erreur explicite et demande de vérifier les totaux ; elle n’offre pas encore une transaction commune. Un RPC transactionnel avec verrouillage devra être prévu avant de traiter ce module comme une paie finalisée. Aucune migration supplémentaire n’a été ajoutée dans cette demande d’activation/audit.

Fichier corrigé : `src/lib/hr/actions.ts`. Les taux de paie des tests sont configurables et fictifs : deux salaires bruts de 10 000 et 20 000 produisent les résultats attendus indépendamment, mais ces exemples ne certifient pas un barème réglementaire.

### Prévisions : dates et lecture du solde initial

Le décalage de date a été reproduit sous `Africa/Casablanca` : ajouter un jour à `2026-11-01` pouvait renvoyer encore `2026-11-01`, car une construction/minuit en heure locale était convertie en chaîne UTC. Les deux helpers utilisent maintenant un minuit UTC et des opérations UTC. Les dates quotidiennes, échéances de remplacement à +30 jours, changements de mois/année, année bissextile et dates autour des changements d’heure sont vérifiées sous UTC, Casablanca et New York.

Une erreur de lecture de `treasury_accounts` est désormais propagée. Elle ne peut plus apparaître comme un solde initial de zéro dans le résultat de prévision.

Fichier corrigé : `src/lib/treasury/treasury-forecast.ts`.

## Écarts fonctionnels restant visibles

Les treize routes canoniques réservées sont :

- Agenda : `/agenda`, `/agenda/echeances`, `/agenda/rappels`, `/agenda/relances`, `/agenda/taches`.
- GED dédiée : `/documents/archives`, `/documents/modeles`, `/documents/pieces-jointes`.
- Outils : `/outils`, `/outils/audit-log`, `/outils/import-export`.
- `/rapports` et `/stock/inventaire`.

Sept anciens écrans réservés s’ajoutent sans représenter sept modules canoniques manquants : `/avoirs`, `/banques`, `/caisses`, `/decaissements`, `/encaissements`, `/paiements`, `/relances`. Par exemple les vrais comptes bancaires et avoirs existent dans leurs nouvelles rubriques. Les anciennes maquettes `/factures/new` et `/factures/[id]` doivent également être distinguées des vraies factures sous `/facturation/factures`.

Les cinq écrans descriptifs sont :

- `/rh/onboarding` et `/rh/offboarding` : cartes de checklist statiques, sans suivi enregistré de ces étapes.
- `/rh/attestations` : quatre cartes ; l’indication « Modèle générable depuis la fiche employé » n’a pas de générateur correspondant dans les pages, composants et services RH inspectés. La fiche salarié contient des tableaux de consultation et un lien Modifier.
- `/rh/contrats/[id]` : affiche l’identifiant reçu et une notice, sans charger le contrat. La création et la liste des contrats sont distinctes et existent.
- `/comptabilite/exports` : six cartes de formats, sans action de téléchargement. Ne pas promettre à partir de ces cartes un export FEC/DGI utilisable. Les exports réels journal et plan comptable existent ailleurs.

Les dix consultations RH sans formulaire de saisie/modification sur leur écran sont Absences, Avances, Congés, Discipline, Documents, Évaluations, Notes de frais, Paramètres, Présences et Prêts. Paramètres RH affiche des valeurs et des compteurs, sans formulaire permettant d’éditer le barème. CNSS et IR sont également des listes préparatoires ; leur description ne constitue pas la preuve d’un export officiel disponible.

Les priorités fonctionnelles sont donc : fiabiliser transactionnellement la paie avant usage final ; relier les paramètres et opérations RH nécessaires ; fournir un vrai détail contrat et générateur d’attestations ; puis finaliser les workflows Agenda/Inventaire/Rapports et les entrées GED/Outils encore réservées. Ces travaux ne sont pas inclus silencieusement dans l’activation commerciale PRO.

## Impressions, exports et limites de couverture

L’inventaire identifie quinze routes de page finissant par `/print` : factures/avoirs/règlements clients et fournisseurs, relances, commandes/réceptions fournisseur, devis/commandes/livraisons/retours clients, journal comptable et bulletin de paie. L’aperçu de prévisions utilise en plus `?print=1`.

Huit handlers sont identifiés explicitement comme export/téléchargement : journal comptable, plan comptable, deux sorties TVA, document GED, export GED, archive de facturation électronique et prévisions. L’inventaire n’inclut pas toutes les générations de CSV faites côté client. Les sorties XML/CSV TVA sont exécutées dans les 45 assertions métier ; les autres handlers ne sont pas tous téléchargés dans cette base isolée. La recette d’impression/PDF multipage du 31 octobre reste une preuve historique distincte dans `training/premium-outputs/20261031/` ; elle n’est pas comptée comme une nouvelle vérification visuelle de tous les documents dans ce rapport.

Cette recette ne certifie pas tous les formulaires navigateur, moteurs de navigateur, données métier réelles, tailles extrêmes de fichier, performances en charge, défaillances réseau hébergées ou accès concurrents. Le stock et la banque ont des répétitions/idempotences testées ; cela ne constitue pas un test de charge général. Les intégrations externes email, Stripe payant, DGI, signature et dépôt CNSS restent hors des opérations exécutées ici.

## Preuves et reproduction

- [Résultat SQL strict](./advanced-database-strict.json) et [assoupli](./advanced-database-relaxed.json).
- [Résultat paie](./payroll-fixtures.json) et [fonctions métier](./domain-fixtures.json).
- [Routes en JSON](./route-matrix.json), [matrice lisible](./ROUTE-MATRIX.md), [actions en JSON](./action-inventory.json) et [actions lisibles](./ACTIONS.md).

Depuis la racine du dépôt, sans environnement de production :

```powershell
node training/pro-full-audit/20261101/inventory-routes.cjs
node training/pro-full-audit/20261101/inventory-actions.cjs
node training/pro-full-audit/20261101/verify-payroll.cjs
node training/pro-full-audit/20261101/verify-domain.cjs
node training/pro-full-audit/20261101/verify-advanced-database.mjs --pglite-root=$env:TEMP/felexia-invitation-postgres-tests
node training/pro-full-audit/20261101/verify-advanced-database.mjs --pglite-root=$env:TEMP/felexia-invitation-postgres-tests --relaxed-v3
```

Le runtime PGlite doit être déjà disponible à l’emplacement explicitement choisi. Le script SQL refuse une URL PostgreSQL et exige un runtime jetable. Il n’installe aucun paquet et ne se connecte pas à Supabase.
