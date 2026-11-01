# Compléments hébergés en lecture seule

## S01 — Contrat actif sans fin

La lecture ciblée du 1er novembre à 13:03 UTC confirme l'unique contrat canonique `active` sans `current_period_end`. Son code durable est `starter`, son début de période est renseigné et aucune fin de période ou d'essai n'est présente. Ni le contrat ni sa société ne possèdent une référence client ou abonnement Stripe.

Sans cible Stripe vérifiée, aucune recherche Stripe globale par nom/email n'a été tentée et aucun appel Stripe n'a été effectué. La classification QA, historique ou client payant reste indéterminée. Il n'existe donc pas de date Stripe prouvée à restaurer.

Plan de traitement : faire qualifier en privé par le propriétaire l'origine de ce contrat et ses dates/statut réels, présenter le cas concret, puis demander la confirmation à l'agent principal avant toute correction. Maintenir la lecture et ne pas inventer une échéance. Aucune donnée n'a été modifiée. Preuve : `undated-contract-qualification.json`, sans nom, ID ni coordonnées.

## S06 — Rappels du matin

À 13:07 UTC, les compteurs hébergés montrent 97 rappels d'essai créés ce jour, tous dans la fenêtre 06:00–07:00 UTC, pour 97 lignes d'abonnement candidates au job. Cela corrobore un passage matinal correspondant à la fenêtre planifiée.

Ces notifications peuvent aussi être produites lors des visites du tableau de bord. Leur présence ne démontre donc pas à elle seule le déclencheur cron, l'absence d'erreurs partielles ou une délivrance email. Le handler de cron crée des notifications applicatives ; il ne constitue pas une preuve de livraison SMTP.

Les journaux runtime Vercel restent inaccessibles au connecteur (403 communiqué par l'agent principal), et aucune CLI installée n'a été trouvée lors du repli précédent. Aucun login, installation, déclenchement de job ou envoi n'a été tenté. Preuve : `job-metadata.json` et le constat précédent `training/launch-audit/20261101/security/observability.json`.
