# Relances clients

Le recouvrement est réservé à l'offre PRO. Le menu Essentiel ne change pas.

## Balance et file

Facturation → Balance âgée montre l'encours, le retard et un DSO de gestion sur 90 jours. Ce n'est pas un ratio certifié.

Facturation → Recouvrement liste les factures dont le scénario est atteint aujourd'hui. Un clic prépare la relance. Tant que l'envoi automatique n'est pas coché, rien ne part seul.

Les scénarios usuels, à créer une fois s'il n'y en a pas encore : J-3 courtois, J+7, J+15 ferme, J+30 mise en demeure. Les variables sont `{{client}}`, `{{facture}}`, `{{montant}}`, `{{echeance}}`, `{{rib}}` et `{{lien}}`.

Le message ferme rappelle que les délais entre professionnels relèvent notamment de la loi n° 69-21, qui a réformé le dispositif de la loi n° 32-10. Felexia ne calcule pas de pénalité et ne donne pas de conseil juridique.

Une formule courte en arabe peut être ajoutée. Ce n'est pas une traduction certifiée.

## Canaux

- E-mail : envoyé seulement si `FELEXIA_OUTBOUND_EMAIL_URL` reçoit un POST JSON `{ to, subject, text }`. Sinon le texte est journalisé.
- WhatsApp : lien `wa.me` prérempli, ouvert à la main.
- Courrier : impression du modèle existant.

## Arrêt

Une facture soldée sort de la file. Un client en litige ou en pause, et une promesse de paiement encore ouverte, sont exclus.

La tâche quotidienne `/api/cron/customer-reminders` ne prépare des e-mails que pour les entreprises PRO qui ont coché l'envoi automatique, et seulement si l'expéditeur répond. Elle est sans effet pour les autres.
