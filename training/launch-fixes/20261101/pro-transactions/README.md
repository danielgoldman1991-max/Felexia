# Correctifs transactions PRO — 1er novembre 2026

Code et SQL préparés localement, **aucun SQL appliqué au cloud et aucune publication effectuée par ce lot**. Les migrations105/106 sont destinées à l’application manuelle après104. L’installateur isolé [pro-transactions-105-106.sql](../../../../supabase/pro-transactions-105-106.sql) installe les deux dans une seule transaction ; il ne contient pas107. Le lot principal prépare séparément le bundle105–107 et sa recette intégrée.

## Corrections

- **P01 — Création/édition devis, commandes clients et commandes fournisseur :** `save_pro_commercial_document_atomic` effectue l’ensemble dans une transaction. Verrou du document, version `updated_at` monotone, état brouillon, entreprise, membre actif, rôle, abonnement non expiré et PRO sont contrôlés. Les références tiers/articles/unités/TVA sont scoppées ; les types de tiers suivent le parcours prospect→commande→client à confirmation. Les totaux sont recalculés en SQL. Une ligne invalide ou une panne laisse exactement l’ancien en-tête et les anciennes lignes, ou aucun nouvel en-tête.
- **Conversion devis→commande :** `convert_pro_quote_to_order_atomic` verrouille le devis, copie les valeurs et conditions acceptées, puis relie les deux documents dans la même transaction. Une répétition renvoie la commande déjà créée. Erreur à la copie ou à la mise à jour du devis : aucune commande orpheline. Les montants historiques non finis, références incohérentes et totaux non concordants sont refusés. Pas de nouvelle conversion d’un devis déjà converti vers une seconde commande.
- **R01 — Préparation de paie :** `prepare_hr_payroll_atomic` calcule côté SQL depuis les salariés et paramètres verrouillés, puis enregistre tous les bulletins et les totaux de période dans la même transaction. La version de période empêche un recalcul depuis une page obsolète. Les bulletins finalisés ou correspondant à des salariés sortis du calcul font refuser le recalcul.
- **R02 — Paramètres manquants :** absence de paramètres, taux sociaux activés incomplets/non finis, plafond CNSS manquant/non fini et barème IR vide/invalide ne peuvent plus devenir une préparation enregistrée avec net=brut. Les erreurs sont affichées dans le formulaire. Aucun taux ou barème réglementaire n’a été inventé ni enregistré. **Paramètres RH reste un écran de consultation ; les réglages effectifs doivent être configurés et vérifiés avant ce calcul.**
- **R03 — Salaires :** les actions refusent les valeurs manquantes ou invalides, exigent zéro explicite si voulu et acceptent intentionnellement `10 000,00`→`10000`. Montants non négatifs, finis et au plus deux décimales ; contrôles de formulaire et contraintes SQL pour salariés/contrats. Les contraintes sont `NOT VALID` pour préserver les lignes historiques tout en contrôlant les nouvelles écritures. Date de fin de contrat et heures hebdomadaires contrôlées.
- **R04 — Périmètre préparatoire :** confirmation explicite du calcul du salaire de base uniquement. Primes, heures supplémentaires, absences, avances/prêts et autres variables ne sont pas intégrés automatiquement. Les nouvelles validations/paiements de période et de bulletin sont refusés par des triggers SQL, y compris en accès REST direct autorisé. Les anciennes données restent lisibles. Il ne s’agit pas de paie finale ni de déclaration sociale/fiscale.

Les actions commerciales, conversion et paie utilisent chacune un unique RPC pour l’écriture concernée. **Si le RPC SQL est absent ou refusé, l’action échoue sans repli vers des écritures séparées.** Les numéros attribués, les relations source et la devise historique d’un document ne sont pas réécrits par l’édition. Les formulaires transmettent la version initialement lue.

L’arrondi des devis/commandes clients est cohérent entre affichage et SQL : HT après remise arrondi au centime, TVA calculée sur ce HT et arrondie, TTC=HT+TVA. Les commandes fournisseur conservent leur convention de base et remise arrondies séparément. La conversion conserve les montants déjà acceptés du devis, sans recalcul avec les taux courants.

## Vérification exécutée

| Preuve | Résultat | Portée |
|---|---:|---|
| [database-strict.json](database-strict.json) | 109 contrôles | Vraies migrations097/099/104/105/106 et RPC, PGlite strict jetable |
| [database-relaxed.json](database-relaxed.json) | mêmes109 contrôles | Seconde configuration, pas109 nouveaux scénarios |
| [installer-strict.json](installer-strict.json) | mêmes109 contrôles | Installation par le fichier combiné105–106, puis réinstallation additive |
| [actions.json](actions.json) | 111 contrôles | Actions TypeScript réelles, session/SDK/Next contrôlés ; création/édition/conversion, paie, erreurs et salaires |
| [payroll-engine.json](payroll-engine.json) | 13 assertions | Calculs témoins indépendants, création de périodes invalides, erreur de lecture |
| [ui.json](ui.json) | 9 contrôles SSR | Formulaire/version/confirmation/messages, période finalisée consultable sans formulaire, période absente refusée |
| [hr-guards.json](hr-guards.json) | 37 contrôles | Rôles/échéance, lecture sans initialisation pour les profils non autorisés ; rapport historique restauré après capture |
| Revue SQL indépendante | 121 mêmes contrôles ×2 | Voir `../forecast-security/REVUE-SQL-INDEPENDANTE.md` : privilèges par défaut larges puis révocations, références/rôles/finitude/conversion, vraies migrations097/105–107 |
| Intégration105/106/107 | 95 mêmes contrôles ×2 | Voir `../essential/integrated-105-107-*.json` : état du harness85 au lancement de cette recette, plus10 cas banque/interop. Les24 contrôles de parité d’arrondi ajoutés ensuite sont dans la suite109 ci-dessus. |

Les109 contrôles incluent24 comparaisons affichage/SQL à quatre références indépendantes, dont quantité1,005/prix1/remise20% et quantité0,333/prix9,99/remise12,5%. La facture fournisseur provenant d’une réception a aussi une fixture d’action dédiée : quantité3×100−remise30+TVA54=324, liens source conservés et ancien RPC atomique de facture préservé.

Le runtime PGlite existant est réutilisé. Les tables comptables historiques minimales et Auth/Storage du bootstrap sont simulés comme documenté dans les recettes précédentes. Les jeux métier sont synthétiques et annulés. Les tests de version vérifient deux tentatives successives ; **ils ne constituent pas un test de concurrence avec plusieurs connexions PostgreSQL natives**. Aucune performance en charge, API Supabase hébergée, formulaire navigateur authentifié ni validation juridique des taux n’est certifiée ici. La relecture React a couvert action authentifiée, état de formulaire, annonces d’erreur/succès et confirmation explicite.

ESLint ciblé des sources et nouveaux scripts : réussi. Le typage/build global est coordonné par le lot principal ; aucun build concurrent n’a été lancé par ce lot. Les empreintes SQL finales figurent dans [sql-manifest.json](sql-manifest.json).

## Rejouer sans accès cloud

```powershell
node training/launch-fixes/20261101/pro-transactions/verify-database.mjs --pglite-root=C:/Users/XXX/AppData/Local/Temp/felexia-invitation-postgres-tests
node training/launch-fixes/20261101/pro-transactions/verify-database.mjs --pglite-root=C:/Users/XXX/AppData/Local/Temp/felexia-invitation-postgres-tests --relaxed-v3
node training/launch-fixes/20261101/pro-transactions/verify-database.mjs --pglite-root=C:/Users/XXX/AppData/Local/Temp/felexia-invitation-postgres-tests --installer
node training/pro-full-audit/20261101/verify-payroll.cjs
node training/launch-fixes/20261101/pro-transactions/verify-ui.cjs
```

Le point d’entrée historique `verify-payroll.cjs` conserve les calculs témoins et vérifications de création de période, puis exécute les nouvelles actions. Il écrit désormais ses preuves dans ce dossier et ne remplace pas son ancien rapport55. La CI exécute aussi les SQL105/106 dans les deux configurations et le SSR. La recette réelle de production devra suivre l’application manuelle du SQL et le déploiement coordonné, sans considérer les indicateurs `pro_105_actif` / `pro_106_actif` comme des preuves de chaque workflow hébergé.

## Complément découvert en revue finale : export du plan comptable

L’ancien handler demandait5000 lignes au service de liste, qui plafonne volontairement chaque page à100 : l’export omettait donc les comptes suivants. Le helper `listChartOfAccountExportRows` lit désormais toutes les pages, triées par code puis identifiant, avec les mêmes filtres que la liste et l’entreprise issue de la session. Aucune initialisation n’est appelée. Les erreurs de première page ou de page suivante font échouer l’export au lieu de livrer un CSV partiel.

Le handler utilise `csvResponse` partagé : champs cités, guillemets échappés, textes pouvant devenir des formules neutralisés, réponses `private, no-store`. Les paramètres de page de la liste ne bornent pas l’export.

[chart-export.json](chart-export.json) : **17 contrôles** du vrai helper, handler et sérialiseur, SDK/session contrôlés.1601 comptes synthétiques, plafond37, identifiants sans perte/doublon, filtres combinés, entreprise étrangère et archives exclues, nom contenant formule/point-virgule/guillemets/retour à la ligne conservé dans une seule cellule. Lint ciblé réussi. Pas de SQL modifié, de seed ni d’accès hébergé pour ce complément.

```powershell
node training/launch-fixes/20261101/pro-transactions/verify-chart-export.cjs
```
