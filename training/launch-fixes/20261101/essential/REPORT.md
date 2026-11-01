# Correctifs ESSENTIEL et rapports comptables — 01/11/2026

## Modifications prêtes

- **E01** : les montants clients utilisent un périmètre partagé des factures validées, envoyées, partiellement réglées, réglées ou échues. Brouillons et annulations exclus des montants/retards ; une facture sans reste dû n'est pas comptée en retard. Libellé « Factures émises » explicite. Les compteurs brouillons restent disponibles.
- **E02** : compteurs factures/règlements clients et factures/règlements fournisseurs lus intégralement par `readAllPages`, avec ordre unique `id`. Les disponibles fournisseurs incluent aussi les règlements partiellement affectés.
- **E03** : erreur de lecture achats, même en deuxième page, donne une erreur explicite ; les pages achats affichent « momentanément indisponibles » et jamais de faux zéro. Les exceptions d'authentification/navigation restent propagées.
- **P03** : `getAccountingReportLines` pagine tous les postes comptabilisés de la société/période. Ancien plafond10 000 supprimé, filtres conservés et ordre `id` stable avant le tri de présentation.
- **E04** : sélection, création et édition d'un compte préféré passent par des RPC atomiques. Cible vérifiée avant remise à zéro, verrou par société, rôles/abonnement vérifiés, RLS existante conservée par `SECURITY INVOKER`. Une panne après remise à zéro ou après édition/création restaure toutes les données précédentes. Solde/ouverture/entreprise/auteur ne sont pas réécrits depuis un payload d'édition. Un compte historique EUR ne peut pas être re-libellé MAD.

## Migration nécessaire, non appliquée

Fichier : `supabase/migrations/107_treasury_default_account_atomic.sql`.

SHA256 : `5eb6b6f579c3498199ffd44cace03466b9fa9425b57e648c9c8dc35cee5802c2`.

À appliquer manuellement après099, avec les autres migrations du lot selon le bundle consolidé. Prérequis vérifiés ; installation/réinstallation ne change aucun compte, solde ou choix existant. Dernier indicateur attendu : `treasury_107_actif = true`.

Si107 est absente, sélection/création/édition préférée échouent avec le message de mise à niveau **avant toute insertion ou modification directe**. Il faut donc installer107 avant de publier le code qui l'utilise. Aucun SQL hébergé appliqué par cet agent.

## Vérification locale actuelle

| Suite | Résultat | Portée |
| --- | --- | --- |
| `verify-financial-indicators.cjs` | **43 réussis** | Vraies fonctions/actions et composant SSR, SDK/sessions synthétiques : tous statuts, archivage/tenant,1 101 lignes sous caps37/1 000,10 001 lignes comptables sous caps37/1 000/10 000, panne de page2, état indisponible, auth, refus rôles/échéance, RPC sans écriture directe préalable, succès et redirection création/édition |
| `verify-treasury-default.mjs` strict | **40 réussis** | Vraie migration107 dans PGlite jetable, pannes après reset/édition/création, RLS stricte, EUR, privilèges, tenant/rôles/échéance, soldes et réinstallation préservés |
| Même suite relaxed | **39 réussis** | Même vérification avec politiques historiques assouplies, sans élargir ces politiques |
| Intégration SQL105–107 | **119 réussis strict /119 relaxed** | Les trois migrations coexistent dans la même base jetable ;109 scénarios commerciaux/paie105–106 actuels conservés, dix cas107 ajoutés. Banque disponible en ESSENTIEL actif, autres RPC PRO refusés en ESSENTIEL, rôles/échéance et données financières conservés. Empreintes des trois migrations dans les JSON |
| Installateur unique105–107 | **137 réussis strict /137 relaxed** | Vrais octets du bundle, panne injectée107 annulant objets105/106, anciennes données fictives préservées, quatre indicateurs vrais, réapplication et désactivation/réactivation des six RPC ; inclut les119 scénarios intégrés ci-dessus |
| Services existants | **30 réussis** | Pagination/exports/trésorerie/journaux,382 lectures synthétiques, aucune mutation |
| Régressions QA existantes | Réussies | Remises, prévisions, statuts documentaires, seed et fin de mois d'essai |
| Lint ciblé | Réussi | Dix fichiers source modifiés, revue React appliquée aux états de page |

Rapports JSON et logs dans ce dossier. Les assertions se recoupent : elles ne représentent pas autant de parcours de bout en bout. Pas de nouveau navigateur, paiement, email, cloud, commit ou publication. Pas de `tsc`/build global pendant les éditions concurrentes ; ils sont réservés au coordinateur.

Limites : PGlite séquentiel ne prouve pas une concurrence native multi-connexion. Les vrais RPC et SQL sont testés séparément de la frontière Next/session simulée ; une recette hébergée QA après installation manuelle du bundle reste à exécuter. La passerelle e-facture historique ne convient pas directement à105–107 : voir `GATEWAY-FEASIBILITY.md` ; aucun nouveau service n'a été lancé.

Installateur manuel final : `supabase/launch-fixes-105-107.sql`, SHA256 `7967b1409ecd7c91f7e8b32073d7385c43f7558350a19ac7e49d1d5f8ad37394`. Instructions et retour arrière fermé sans suppression de données : `supabase/launch-fixes-105-107.README.md`. Aucun de ces fichiers n'a été exécuté sur le cloud.
