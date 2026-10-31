# Exploitation de Felexia Pro Essentiel

## Vérifications après publication

Le point de contrôle public `/api/health` retourne HTTP 200 uniquement si une lecture de la base réussit. Une indisponibilité, une erreur de configuration ou un dépassement de cinq secondes retourne HTTP 503. Il ne publie ni secrets ni données d'entreprise. Configurer un contrôle HTTP externe sur cette URL avec une alerte vers le responsable d'exploitation.

Le workflow `.github/workflows/essential.yml` installe les dépendances verrouillées, contrôle les vulnérabilités de production, le lint des sources, les régressions essentielles et le build. Les clés de production ne doivent pas être ajoutées à GitHub pour ces tests. Les scénarios qui créent des documents utilisent exclusivement une entreprise de recette explicitement identifiée.

## Notifications d'essai

`vercel.json` programme le traitement quotidien à 06:00 UTC. Définir `CRON_SECRET` dans les variables serveur Vercel, avec une valeur aléatoire forte conservée dans le gestionnaire de secrets de l'exploitant. Vercel transmet ce secret dans l'en-tête Bearer du cron. Sans secret, l'endpoint retourne 503 ; avec un secret incorrect, 401. Ne jamais rendre le cron anonyme.

Après configuration, vérifier les journaux d'exécution et une notification unique sur une entreprise de recette. Une lecture de `/api/health` ne valide pas l'exécution du cron.

## Emails et récupération de compte

Configurer le SMTP dans Supabase Authentication avec une adresse d'expédition réelle et un nom Felexia Pro. Les identifiants restent dans Supabase. Les URL de retour doivent inclure les chemins d'invitation et de récupération utilisés par le domaine canonique. Tester la réception, le renvoi, les liens expirés, l'activation du membre et la récupération de compte. Une inscription auto-confirmée ne démontre pas la réception d'un email.

## Abonnement

Configurer les prix Essentiel mensuel et annuel et un webhook signé correspondant au déploiement. Tester d'abord en environnement Stripe de test : première souscription après essai, renouvellement, échec de paiement, reprise, résiliation et événement reçu plusieurs fois. Vérifier à chaque étape le statut, les dates, les droits d'écriture et l'accès de consultation. Une page de succès ne remplace pas la confirmation du webhook.

## Sauvegarde de la base et des fichiers

Les fichiers Git `.bundle` sauvegardent le code et les migrations. Ils ne sauvegardent pas les entreprises, comptes d'authentification, factures ni fichiers Supabase.

Avant une migration et régulièrement en exploitation :

1. Vérifier la sauvegarde gérée et sa rétention dans Supabase Database > Backups, selon le plan du projet. Conserver une copie indépendante si la politique de l'entreprise le requiert.
2. Sauvegarder également les objets Storage et leurs métadonnées. Une sauvegarde PostgreSQL ne contient pas les octets des logos et pièces jointes.
3. Utiliser un compte serveur dédié et un stockage chiffré à accès limité. Aucun dump réel, URL de connexion, mot de passe, clé service ou lien d'authentification ne doit être commité dans ce dépôt.
4. Restaurer dans un projet isolé avec les mêmes versions et migrations. Ne pas remplacer la production pour tester une restauration.
5. Contrôler le nombre de documents et de lignes, les montants, les affectations, les soldes, les écritures équilibrées, les fichiers et les droits des trois profils.
6. Consigner date de sauvegarde, date de restauration, opérateur, versions, contrôles, durée et écarts. Désigner le responsable de restauration et le délai attendu.

Un export CSV utilisateur facilite la récupération des données métier ; il ne remplace pas une sauvegarde de reprise complète.

## Incident métier

Conserver l'identifiant de l'entreprise, le type d'opération, l'heure et la référence du document. Ne pas demander de mot de passe ni de clé API à l'utilisateur. Vérifier d'abord l'abonnement, les droits, l'état du document et les journaux serveur. Un règlement comptabilisé ne doit pas être modifié monétairement sans procédure de correction comptable. Les écrans de consultation et d'export restent disponibles après échéance.

Pour revenir sur un déploiement, utiliser la sauvegarde source et une version compatible avec le schéma installé. Les migrations de protection ne doivent pas être annulées en désactivant les RLS ou en supprimant des données.
