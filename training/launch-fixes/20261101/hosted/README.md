# Recette hébergée ciblée après SQL105–107

`verify-hosted-actions.cjs` utilise le manifeste privé existant, avec garde exacte société/run et les trois alias autorisés. **Par défaut, il termine en mode plan avant le chargement de `.env`, Auth ou réseau.** Aucune mutation QA n'a été exécutée pendant sa préparation.

```powershell
node training/launch-fixes/20261101/hosted/verify-hosted-actions.cjs
```

Le contrôle d'installation authentifie seulement l'administrateur QA par la clé publique, appelle la capacité stable105/106 et consulte l'OpenAPI avec son JWT authenticated. Il n'emploie pas le rôle service pour conclure sur la visibilité107 et ne change aucun contrat ni donnée métier. Les horodatages techniques Auth peuvent avancer ; sa session locale est fermée.

```powershell
node training/launch-fixes/20261101/hosted/verify-hosted-actions.cjs --check-installed
```

Le mode `--read-only` peut en plus contrôler les trois rôles, les références QA et les empreintes financières. Aucun de ces modes ne change l'offre ou les dates.

**Commande préparée, non exécutée : après confirmation utilisateur du SQL et GO de l'agent principal uniquement.**

```powershell
node training/launch-fixes/20261101/hosted/verify-hosted-actions.cjs --execute-qa-actions --confirm-sql-105-107 --allow-temporary-qa-pro
```

Cette exécution exige un essai ESSENTIEL encore valable sans abonnement Stripe, les capacités SQL attendues, l'absence de récupération précédente incomplète et l'absence d'audit QA concurrent. Un journal complet reste hors Git dans `../backups`. Il précède la modification par compare-and-swap des seuls `plan_code` et `plan_id`. Les dates/statut ne sont jamais étendus ni réécrits.

Les vraies actions TS et SDK sont exécutés avec les seules frontières Next fournies par `essential-action-runner.cjs`. Cas : création/édition de devis et commande fournisseur avec version, refus de version périmée avec motif précis, conversion répétée vers une seule commande, refus opérateur/lecteur par action et RPC, cible de compte préféré absente via action et107 sans toucher la banque. Si les paramètres de paie QA sont **déjà incomplets**, création d'une période fictive inutilisée puis refus de préparation sans bulletin/total modifié. Sinon ce dernier cas est explicitement non couvert ; aucun paramètre n'est effacé pour le forcer.

Le `finally` nettoie seulement les IDs créés par ce run, absents de la baseline et vérifiés par marqueur unique/créateur/date. Il restaure ensuite le contrat, en vérifiant toutes ses valeurs métier, puis les empreintes des données financières, commerciales, RH et références préexistantes. `updated_at` du contrat peut avancer. Les compteurs et traces d'émission/suppression QA restent monotones et sont signalés ; ils ne sont jamais rembobinés.

Une divergence du contrat ou un bulletin inattendu suspend la remise en état concernée et laisse le journal privé pour revue. Le script bloque un nouveau run si sa récupération reste incomplète ; il ne supprime pas des données existantes pour produire un résultat vert. Une coupure réseau/arrêt brutal peut nécessiter une récupération supervisée : ne pas relancer aveuglément.

Le réseau est limité au projet Supabase et aux endpoints Auth token/user/logout. Les autres destinations ainsi que signup/invitation/récupération sont bloqués. En lecture seule, les mutations REST sont bloquées, sauf le RPC stable des capacités. Aucun Stripe, paiement, email, invitation, DGI ou cron n'est prévu. Les résultats publics ne contiennent jamais le manifeste, noms, IDs privés ou mots de passe.

Limites : vrais SDK/actions avec contexte Next fourni, pas chaque formulaire navigateur ni concurrence multi-connexion. Les quatre nouvelles tables de compteur/audit sont comparées et leurs changements attendus explicitement conservés. Les preuves de préparation du script sont distinctes d'une exécution hébergée réussie.
