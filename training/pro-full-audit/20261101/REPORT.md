# PRO sur devis et audit complet — 1er novembre 2026

## Résultat demandé

PRO est présenté uniquement « Sur devis », avec une demande de devis préremplie. Aucun montant PRO ni achat direct PRO ne doit apparaître dans la vitrine ou l’abonnement. ESSENTIEL conserve 290 MAD/mois et 2 900 MAD/an. Le portail Stripe propose uniquement les deux périodicités ESSENTIEL ; les anciennes références de prix et abonnements restent conservées.

Le compte administrateur de **MENARAPRO** dispose de PRO : les treize modules sont activés, jusqu’à l’échéance déjà prévue de son essai, **le 1er décembre 2026**. Aucun paiement ou abonnement Stripe n’a été créé. Le statut, les dates, les références Stripe et les champs monétaires existants ont été conservés. Les empreintes des huit tables financières de contrôle sont identiques après activation. La sauvegarde et le journal d’intervention contenant l’identité et l’ancien contrat sont privés, hors dépôt.

## Rapport fonctionnel à consulter

Le [rapport d’audit complet](./AUDIT-COMPLET.md) détaille les opérations testées, les défauts corrigés et les limites par module. La [matrice des routes](./ROUTE-MATRIX.md) inventorie 250 pages et 33 handlers ; le [catalogue d’actions](./ACTIONS.md) inventorie 223 exports serveur. **Ces inventaires ne constituent pas 250 tests fonctionnels réussis.**

L’accès PRO donne accès à la version étendue sauvegardée, mais plusieurs sous-fonctions restent à terminer : treize routes canoniques réservées (Agenda, entrées GED/Outils, Inventaire et Rapports), cinq écrans descriptifs dont le détail de contrat et la page centrale d’exports comptables, et dix consultations RH sans formulaire complet. Les fonctions TVA, CNSS/IR et paie restent préparatoires. Les promesses commerciales de rapports avancés ont été remplacées par les tableaux de bord et exports réellement disponibles.

## Tests et corrections

| Série | Résultat | Portée |
|---|---:|---|
| Compte propriétaire, HTTP local authentifié | 120/120 GET réussis | 108 pages, 6 détails existants, 6 CSV ; 21 tables financières inchangées ; aucun formulaire soumis |
| Société de recette PRO, HTTP local | 183 contrôles | 181 chargements200 et 2 refus404 attendus pour documents non modifiables ; aucun500 ; contrat restauré après accès temporaire |
| SQL avancé jetable | 45 assertions par configuration | Deux configurations ; stock, transferts, livraisons/retours, réceptions, rapprochement, rôles et isolation ; rollback des données synthétiques |
| Paie, vrais moteur/actions avec frontières contrôlées | 55 assertions | Refus des états finalisés, erreurs de lecture/écriture, lot de bulletins |
| Prévisions, calculs et XML/CSV | 45 assertions | Trois fuseaux, dates, soldes journaliers et sérialisation |
| Commercial sur devis, rendu SSR | 87 assertions | PRO sans montant ni cycle, ESSENTIEL inchangé, demande de devis, accès de test |
| Facturation | 96 assertions | PRO/premium refusés avant Stripe ou lease, helpers directs/legacy, mapping historique conservé |
| Portail sur devis | 16 assertions | Deux prix ESSENTIEL seuls, conservation des réglages, sauvegarde et rollback |
| Notifications | 58 contrôles | PRO vers demande de devis, anciens rappels conservés sans CTA de paiement inadapté |

Les séries se recouvrent et ne sont pas additionnées. Les tests de formulaire client, paiements réels, envois d’email, dépôt fiscal/social et charge générale ne sont pas certifiés par ces chiffres. Les routes sans données de détail et les GET qui initialisent des références ont des exclusions explicites. Les seules initialisations hébergées admises ont eu lieu dans la société synthétique de recette, dont les références RH ont été créées ; les tables financières et métier capturées restent identiques.

Trois corrections applicatives ont été apportées :

1. La paie refuse les données incomplètes et états finalisés, enregistre les bulletins dans un lot et remonte explicitement les erreurs ; elle n’annonce plus une réussite si la période n’est pas enregistrée.
2. Les dates de prévision utilisent UTC, corrigeant le décalage d’un jour reproduit avec `Africa/Casablanca`.
3. Une erreur de lecture des comptes de trésorerie est remontée au lieu d’afficher un faux solde initial de zéro.

La paie utilise encore deux requêtes successives pour les bulletins puis la période. Une panne ou finalisation concurrente entre les deux peut laisser un lot non consolidé : ce point reste à rendre transactionnel avant usage de paie finalisée. Les détails et priorités sont dans l’audit complet.

## Sécurité et publication

Sauvegarde initiale `codex/backup-before-pro-quote-test-20261101` et bundle vérifié `../backups/felexia-before-pro-quote-test-20261101.bundle`. Branche de travail `codex/pro-quote-full-audit-20261101`. Aucune nouvelle migration SQL ni transmission fiscale. Le portail Stripe géré a été modifié sans toucher aux produits, prix, clients ou abonnements ; journal privé de rollback conservé.

Typage, lint et build optimisé locaux réussis. L’aperçu courant est sur3112. La publication Git avec environnement Production et ses contrôles finaux seront consignés dans la preuve de livraison.
