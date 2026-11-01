# Revue indépendante SQL105–107

Revue du 1er novembre 2026, après stabilisation des sources. Aucun SQL hébergé, aucune configuration ou donnée client n'a été modifié par cette revue.

## Conclusion

Les contre-exemples signalés pendant la revue ont été corrigés par les agents propriétaires des migrations : déduction IR/plafond CNSS non finis, unité de référence `U` contournée par son symbole ou le payload, type du tiers, incohérence du taux référencé, conversion de devis contenant des montants historiques NaN, et relabellisation d'un compte EUR en MAD. Les procédures atomiques actuelles passent les tests supplémentaires exécutés indépendamment.

Le runner `review-transactions.mjs` reprend le bootstrap jetable du lot PRO, puis ajoute des scénarios adverses et des privilèges par défaut volontairement larges avant installation. Il ne remplace aucune garde d'abonnement, rôle, RLS, numérotation ou RPC par une simulation. L'authentification SQL et certaines tables comptables historiques sont explicitement simulées, car leur création historique n'est pas présente dans le dépôt. Les migrations métier, dont **097**, 099, 104 et 105–107, sont réellement installées dans PGlite.

## Preuves fraîches

| Mode | Résultat | Preuve |
|---|---:|---|
| Gardes financières strictes | 121 contrôles réussis | `review-database-strict.json` |
| Gardes historiques assouplies | 121 contrôles réussis | `review-database-relaxed.json` |

Ces comptes comprennent la suite PRO et les extensions du reviewer ; ne pas les additionner aux comptes de la suite PRO comme des contrôles indépendants uniques. Toutes les lignes métier synthétiques sont annulées en fin de transaction.

Extensions spécifiques de la revue :

- `ALTER DEFAULT PRIVILEGES` accorde initialement EXECUTE à PUBLIC, anon, authenticated et service_role. Après installation, anon et service_role ne disposent plus d'EXECUTE sur les six RPC publics contrôlés ; authenticated conserve uniquement son octroi prévu.
- Refus de conversion pour lecteur, opérateur, non-membre, entreprise étrangère, source de type commande ou devis vide ; refus des montants NaN dans un en-tête et dans une ligne historiques.
- Refus indépendant des déductions IR `NaN`, `Infinity`, `-Infinity` et du plafond CNSS NaN ; pas de salaire net non fini silencieusement enregistré.
- Référence unité dont le nom est `U` et le symbole vide : une quantité de 1,5 avec payload mensonger `kg` est refusée.
- Tiers uniquement client refusé sur commande fournisseur ; tiers uniquement fournisseur refusé sur devis client. Le prospect demeure autorisé sur devis et commande, conformément au parcours de promotion lors de confirmation.
- Appartenance désactivée et rôle SQL authenticated sans `auth.uid()` ne donnent aucun accès aux fonctions definer. Le refus conserve le brouillon existant.

## Lecture de l'atomicité et des formulaires

105 verrouille le document avant remplacement, exige une version `updated_at` monotone et réserve l'édition aux brouillons du bon type. L'en-tête, la suppression des anciennes lignes, l'insertion des nouvelles et les totaux recalculés appartiennent au même appel transactionnel. Les notes et conditions de paiement saisies sont conservées. Les numéros et la devise existants ne sont pas réécrits par ce save. L'identifiant d'entreprise vient de la session côté action et toutes les relations sont contrôlées côté SQL.

La conversion verrouille le devis, copie ses montants/conditions valides sans réévaluer les taux actuels, crée la commande et met à jour le lien/statut du devis dans le même appel. Une répétition retourne la commande existante. Les pannes injectées pendant les lignes et la mise à jour de la source annulent l'ensemble. La nouvelle action n'effectue plus la conversion par plusieurs écritures Supabase successives.

106 verrouille période, paramètres, employés et bulletins existants, exige la version et un consentement explicite à la préparation du salaire de base. Les bulletins et le total de période sont enregistrés ensemble. Les fonctions refusent les états finalisés, les valeurs non finies et les paramètres incomplets. Les triggers sur périodes **et** bulletins refusent validation/paiement finals. Aucune conformité officielle de paie ni inclusion des variables n'est déclarée.

107 utilise un verrou consultatif par entreprise pour les changements de compte préféré. Les RPC restent `SECURITY INVOKER` pour conserver les RLS financières et contrôlent appartenance active, rôle et échéance via le helper. La cible est verrouillée avant la réinitialisation du défaut. La garde de devise refuse désormais une cible EUR avant toute réécriture de métadonnées ou de solde. Les preuves spécialisées du lot ESSENTIEL couvrent aussi les pannes après réinitialisation/création/édition.

## Empreintes validées

| Fichier | SHA-256 |
|---|---|
| `105_pro_commercial_transactions.sql` | `cc7c5e690766e2355bf3c0c999ece6fc9bef8af9f3d72a2c5afa5557ee0d43cf` |
| `106_preparatory_payroll_transactions.sql` | `d7c56e0f41eb02a2c142248562b406a36e74365b30d72ced25d69237e33c59f1` |
| `107_treasury_default_account_atomic.sql` | `5eb6b6f579c3498199ffd44cace03466b9fa9425b57e648c9c8dc35cee5802c2` |

## Limites

La concurrence testée comprend les reprises, versions périmées et idempotence sérielle ; ce moteur jetable ne démontre pas une course entre plusieurs connexions PostgreSQL réelles. La revue des verrous confirme le mécanisme attendu mais ne remplace pas cette preuve. Les contrôles portent sur les nouveaux RPC, leurs gardes et leurs interactions avec les migrations chargées ; ils ne certifient pas chaque mutation REST historique des tables PRO. Les migrations restent à appliquer manuellement par l'utilisateur, puis les capacités et refus doivent être vérifiés sur l'environnement cible avant d'annoncer les nouveaux parcours opérationnels.
