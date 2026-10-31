# Publication, éléments en attente et retour arrière

## À terminer avant toute production

- [ ] Autorisation explicite de publication du propriétaire : **non reçue pour ce module**.
- [ ] Sauvegarde réelle de la base hébergée et test de restauration dans un projet isolé ; relever référence, date, résultat et responsable. Le bundle Git ne sauvegarde pas la base.
- [ ] Appliquer102 intégralement d’abord dans un projet Supabase de préproduction ; vérifier `facturation_electronique_102_active=true`, les grants/RLS et le parcours réel Auth/REST.
- [ ] Exécuter la recette sur le service Supabase hébergé, avec des comptes synthétiques admin/opérateur/lecture seule et une seconde entreprise. Les tests locaux ne remplacent pas cette étape.
- [ ] Vérifier politiques de sauvegarde, chiffrement au repos, rétention, accès privilégiés et procédures de restauration chez les hébergeurs ; aucun de ces contrats n’est certifié par le code.
- [ ] Revue fiscale des mentions, taux, motifs d’exonération, RC et cas métiers effectivement applicables ; compléter la matrice réglementaire.
- [ ] Vérifier les démarches CNDP, contrats sous-traitants et transferts applicables à l’exploitant.
- [ ] Examiner les journaux et la taille des fonctions Vercel en préproduction (WASM, XSD, polices embarqués), téléchargement binaire et limites mémoire/temps.
- [ ] Reconstruire depuis les sources avec les variables du projet cible. Ne jamais promouvoir le build local de recette : ses variables publiques pointent volontairement vers la passerelle de test locale.
- [ ] Garder l’activation globale désactivée ; autoriser une seule entreprise pilote via la liste serveur, puis son réglage admin.
- [ ] Configurer la reprise planifiée si souhaitée : route protégée `/api/cron/e-invoicing`, `CRON_SECRET` serveur existant ou dédié au déploiement ; cron non ajouté automatiquement au fichier de production. La reprise manuelle est disponible en supervision.
- [ ] Exécuter une préparation, un avoir, un rejet simulé, une panne/reprise, un contrôle d’intégrité et un téléchargement après expiration d’abonnement sur la préproduction hébergée.
- [ ] Valider le suivi des alertes et le responsable de traitement des anomalies. Ne pas considérer une simulation comme envoi fiscal.

## En attente DGI et services de confiance

| Élément | État |
|---|---|
| Spécifications officielles de document et règles marocaines machine | EN ATTENTE DGI, aucun profil inventé |
| URLs, authentification, sandbox, habilitation et identifiants DGI | EN ATTENTE DGI, mode officiel bloqué |
| Accusés signés et rapprochement officiel | EN ATTENTE DGI, seuls reçus internes simulés existent |
| Prestataire de signature autorisé, certificats, coffre/KMS/HSM et rotation | NON CONFIGURÉ, signature refusée |
| Vérification de confiance, révocation et horodatage reconnu | NON INTÉGRÉ, dépend du prestataire et des exigences vérifiées |
| Réception/validation de factures fournisseurs externes | Hors périmètre outbound V1 ; nécessite adaptateur entrant séparé |
| Archivage légal certifié/PDF-A/WORM | NON FOURNI ; l’archive livrée est applicative avec empreintes |

## Retour arrière préparé

1. Désactiver le réglage organisation en base (`enabled=false`, mode désactivé) avant de retirer l’entreprise de la liste d’activation ou de passer `FELEXIA_EINVOICING_ENABLED=false`. Les variables Next seules ne bloquent pas des appels directs aux RPC autorisés par SQL. Les pièces déjà émises doivent continuer de servir leurs archives.
2. Conserver102 et les archives. **Ne pas supprimer les tables ni désactiver les protections des sources émises** pour revenir à un rendu fiscal modifiable.
3. Revenir à une version applicative compatible avec102 et le téléchargement figé. Un simple retour au commit antérieur au module pourrait réafficher les anciennes impressions vivantes pour les sources émises : à éviter après la première émission.
4. Pour revenir à la version antérieure sans aucune émission, contrôler d’abord les données et l’absence de documents émis ; conserver une copie de102 et de toutes les archives. Toute restauration de base doit suivre une procédure opérateur validée, jamais un script destructif automatique.

Sauvegarde source préalable : `../backups/felexia-before-e-invoicing-20261031.bundle`, branche `codex/backup-before-e-invoicing-20261031`. Le code de ce module reste dans sa branche de travail jusqu’à revue et autorisation.
