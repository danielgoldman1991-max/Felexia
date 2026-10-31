# Abonnement et récupération de compte

Correctifs de l'audit Essentiel A01 à A05 et U01, avec contrôle du quota commercial.

Les loaders lisent désormais `plan_code` sans relation ambiguë. Une erreur de lecture n'invente pas un essai : le contexte de lecture reste disponible, les écritures échouent de façon fermée et la page Abonnement possède un état d'erreur explicite. Le chargement d'un écran ne crée, ne réinitialise et ne prolonge plus aucun abonnement.

## Migration 099

`099_essential_subscription_access.sql` est une transaction additive. La requête finale doit retourner `abonnement_099_actif = true`. Elle doit être installée avant publication des appels RPC correspondants.

- Les données de facturation sont réservées au serveur, y compris le rattachement d'un client Stripe à une entreprise.
- `ensure_essential_trial` permet uniquement à l'administrateur de créer une première période Essentiel d'un mois. Un appel répété conserve les dates existantes ; un essai expiré ne peut pas être recommencé.
- Les écritures des opérations essentielles exigent une période future et un état `trialing` ou `active`. `past_due`, `unpaid`, `canceled`, l'essai expiré et une date active manquante laissent les données en consultation/export. La configuration initiale des journaux et comptes comptables n'est pas assimilée à une opération financière.
- Les 500 documents mensuels Essentiel comptent les factures clients/fournisseurs, avoirs et documents commerciaux du profil complet. Les règlements et pièces jointes ne consomment pas ce quota. Le mois suit Casablanca. Un registre protégé conserve les places consommées après suppression ; l'admission est verrouillée par entreprise.
- Une réservation courte sérialise les préparations de souscription. Les événements Stripe ont une réservation durable, un état de traitement et une reprise après échec ; leur application utilise une transaction par entreprise avec rejet des événements obsolètes et des anciennes souscriptions.

Les anciennes dates, plans et numéros de documents ne sont pas réécrits. Un abonnement actif dépourvu de date de fin devient explicitement non inscriptible jusqu'à resynchronisation ; il ne bénéficie plus d'une permission illimitée implicite.

## Parcours payant

L'essai mensuel peut souscrire au même mensuel. Un abonnement Stripe existant est géré dans le portail ; le changement de cycle ne crée pas une seconde charge récurrente. Un checkout ouvert est réutilisé, ou expiré avant le choix d'un autre cycle. Le client Stripe est vérifié par son entreprise et les API sont réservées aux administrateurs.

Le webhook lit les périodes des éléments d'abonnement et la relation moderne `invoice.parent.subscription_details.subscription`, tout en acceptant les anciens objets. Il relit l'état actuel chez Stripe, vérifie chaque persistance et refuse d'acquitter une erreur de stockage. Une tentative de paiement incomplète ne consomme pas un essai local encore valide.

## Récupération du mot de passe

La connexion donne accès à `/mot-de-passe-oublie`. La demande renvoie le même message pour une adresse connue ou inconnue. Le callback existant `/auth/callback?recovery=1` échange le code PKCE ; un template utilisant `token_hash` de type `recovery` est également supporté.

Le formulaire final exige une preuve signée, HttpOnly, courte et liée au compte authentifié. Elle expire après dix minutes et est consommée après l'enregistrement. Les liens expirés ou ouverts dans un autre navigateur donnent un accès direct à une nouvelle demande. Le mot de passe est validé côté serveur (12 à 128 caractères, lettre et chiffre), confirmé puis la session locale est fermée. Le secret de signature est `RECOVERY_SIGNING_SECRET` s'il est fourni, sinon la clé serveur Supabase existante ; aucun secret n'est exposé au navigateur.

## Vérifications isolées

- 51 assertions PostgreSQL, deux fois (RLS stricte puis assouplie) : état d'abonnement, conservation des lectures, privilèges, essai unique, quota, refus d'un quatrième utilisateur lorsque les trois places sont occupées, refus de réutilisation des places, réservation checkout, reprise/idempotence Stripe, événements retardés et réinstallation. Toutes les fixtures sont annulées.
- 25 contrôles des vrais modules webhook/récupération avec frontières Stripe, base et cookies synthétiques.
- 24 contrôles des vraies routes checkout/portail avec identités et prestataire synthétiques : refus anonyme/viewer/opérateur, plan non public, concurrence, reprise d'une souscription existante, changement de cycle, client étranger et échec de persistance.
- 26 contrôles du vrai callback et des vraies actions de récupération : preuve exigée, code invalide, mauvais compte, signature altérée, erreurs Auth, mot de passe confirmé, consommation de la preuve et fermeture de session.
- 144 contrôles des fonctions de lecture et des gardes pour les trois rôles : aucun bootstrap sur GET, aucun abonnement fictif, consultation conservée, échéances absentes/invalides/expirées, seuil exact et limites publiques.
- 12 scénarios de sécurité du script de recette d'expiration : succès, panne de lecture, réponse de modification perdue, reprise de restauration, panne durable signalée avec snapshot privé conservé, mode restauration seule et refus avant écriture des entreprises étrangères/payantes ou identités inattendues. Ils utilisent exclusivement une base, un SDK et des fichiers synthétiques.
- Typage de l'arbre partagé et lint du lot réussis.

Ces tests ne lisent aucun fichier `.env`, ne se connectent à aucune production et n'envoient ni email ni paiement. Les preuves sont `subscription-postgres-strict.json`, `subscription-postgres-relaxed.json`, `webhook-recovery-tests.json`, `checkout-fixture-tests.json`, `recovery-action-tests.json` et `read-subscription-guards.json`. La CI exécute ces suites ainsi que les contrôles des rôles et callbacks d'invitation.

```powershell
node training/essential-fixes/20261031/verify-subscription-access.mjs --pglite-root=<dossier-contenant-les-dependances-de-test>
node training/essential-fixes/20261031/verify-subscription-access.mjs --pglite-root=<dossier-contenant-les-dependances-de-test> --relaxed-v3
node training/essential-fixes/20261031/verify-webhook-recovery.cjs
node training/essential-fixes/20261031/verify-checkout-fixtures.cjs
node training/essential-fixes/20261031/verify-recovery-actions.cjs
node scripts/verify-operator-read-bootstrap.mjs --report
node training/essential-fixes/20261031/verify-expiry-harness.cjs
```

Après installation, le parent doit vérifier le parcours connecté réel et la réception SMTP autorisée. La boucle de paiement réelle et la configuration du portail/endpoint Stripe restent distinctes des tests synthétiques ; aucun encaissement n'est prétendu validé par ces résultats.
