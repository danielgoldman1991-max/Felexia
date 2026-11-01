# Matrice des routes ERP complet

Inventaire de 250 pages et 33 handlers. Une implémentation présente ne constitue pas une preuve de succès fonctionnel.

| Route | Module | État source | Preuve / limite |
|---|---|---|---|
| / | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /abonnement/choisir | Public ou alias | Redirection | Alias de compatibilité ou étape redirigée. |
| /achats | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/avoirs | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/avoirs/[id] | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/avoirs/[id]/edit | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/avoirs/[id]/print | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/avoirs/new | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/commandes | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/commandes/[id] | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/commandes/[id]/edit | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/commandes/[id]/print | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/commandes/new | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/factures | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/factures/[id] | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/factures/[id]/edit | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/factures/[id]/print | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/factures/new | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/fournisseurs | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/paiements | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/paiements/[id] | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/paiements/[id]/affecter | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/paiements/[id]/print | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/paiements/new | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/receptions | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/receptions/[id] | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/receptions/[id]/print | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /achats/receptions/new | Achats | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /agenda | Agenda | Écran réservé | Planning commercial, relances et echeances de gestion. |
| /agenda/echeances | Agenda | Écran réservé | Echeances commerciales, financieres et administratives. |
| /agenda/rappels | Agenda | Écran réservé | Rappels utilisateur et rappels commerciaux. |
| /agenda/relances | Agenda | Écran réservé | Relances clients, prospects et echeances prioritaires. |
| /agenda/taches | Agenda | Écran réservé | Taches internes et suivi operationnel. |
| /api/auth/create-profile | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/company/search | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/cron/e-invoicing | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/cron/trial-notifications | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/exports/[kind] | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/global-search | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/health | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/invitations | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/invitations/[id] | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/invitations/accept | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/modules/toggle | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/notifications | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/notifications/read | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/notifications/read-all | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/onboarding/complete | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/organization-members/[id] | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/organization-members/[id]/role | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/roles/permissions | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/stripe/checkout | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/stripe/portal | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/stripe/webhook | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /api/subscriptions/start-trial | API | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/[id] | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/[id]/edit | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/categories | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/categories/[id]/edit | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/categories/new | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/new | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/produits | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/services | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/tva | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/tva/[id]/edit | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/tva/new | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/unites | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/unites/[id]/edit | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /articles/unites/new | Articles | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /auth/callback | Authentification | Redirection | Alias de compatibilité ou étape redirigée. |
| /auth/logout | Authentification | Redirection | Alias de compatibilité ou étape redirigée. |
| /avoirs | Public ou alias | Écran réservé | Gestion des avoirs clients et corrections de facturation. |
| /banques | Public ou alias | Écran réservé | Comptes bancaires, soldes et rapprochements a venir. |
| /bienvenue | Guide | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /caisses | Public ou alias | Écran réservé | Suivi des caisses et operations d'especes. |
| /clients | Public ou alias | Redirection | Alias de compatibilité ou étape redirigée. |
| /commandes | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /commandes/[id] | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /commandes/[id]/edit | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /commandes/new | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /commerce | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/auxiliaires | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/balance | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/comptes | Comptabilité et TVA | Redirection | Alias de compatibilité ou étape redirigée. |
| /comptabilite/comptes/[id] | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/ecritures | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/ecritures/[id] | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/ecritures/nouveau | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/exercices | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/exports | Comptabilité et TVA | Écran descriptif | Six cartes de formats sans lien ou bouton de téléchargement ; utiliser les exports réels journal ou plan comptable. |
| /comptabilite/grand-livre | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/journal-general | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/journaux | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/journaux/[id] | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/journaux/[id]/export | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/journaux/[id]/print | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/parametres | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/plan-comptable | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/plan-comptable/[id] | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/plan-comptable/[id]/edit | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/plan-comptable/export | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/plan-comptable/init | Comptabilité et TVA | Redirection | Alias de compatibilité ou étape redirigée. |
| /comptabilite/plan-comptable/new | Comptabilité et TVA | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /comptabilite/tva | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /comptabilite/tva/controle | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /comptabilite/tva/declarations | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /comptabilite/tva/declarations/[id] | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /comptabilite/tva/declarations/new | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /comptabilite/tva/exports | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /comptabilite/tva/exports/[id]/download | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /comptabilite/tva/exports/export | Comptabilité et TVA | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /conditions | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /confidentialite | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /dashboard | Dashboard | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /decaissements | Public ou alias | Écran réservé | Vue consolidee des sorties de tresorerie. |
| /devis | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /devis/[id] | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /devis/[id]/edit | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /devis/new | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /documents | GED | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /documents/[id]/download | GED | Redirection | Alias de compatibilité ou étape redirigée. |
| /documents/archives | GED | Écran réservé | Documents archives et historique de conservation. |
| /documents/export | GED | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /documents/import-export | GED | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /documents/modeles | GED | Écran réservé | Modeles de devis, factures, livraisons et documents ERP. |
| /documents/pieces-jointes | GED | Écran réservé | Fichiers rattaches aux tiers, articles et documents commerciaux. |
| /encaissements | Public ou alias | Écran réservé | Vue consolidee des entrees de tresorerie. |
| /facturation | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/avoirs | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/avoirs/[id] | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/avoirs/[id]/affecter | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/avoirs/[id]/edit | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/avoirs/[id]/print | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/avoirs/new | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/electronique | Facturation | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /facturation/electronique/[kind]/[sourceId] | Facturation | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /facturation/electronique/[kind]/[sourceId]/download | Facturation | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /facturation/electronique/configuration | Facturation | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /facturation/electronique/supervision | Facturation | Préparatoire | Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle. |
| /facturation/factures | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/factures/[id] | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/factures/[id]/edit | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/factures/[id]/paiement | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/factures/[id]/print | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/factures/new | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/paiements | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/paiements/[id] | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/paiements/[id]/affecter | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/paiements/[id]/edit | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/paiements/[id]/print | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/paiements/affectation | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/paiements/new | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/relances | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/relances/[id] | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/relances/[id]/print | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /facturation/relances/new | Facturation | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /factures | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /factures/[id] | Public ou alias | Maquette legacy | Ancien écran statique sans persistance ; les vraies factures sont sous /facturation/factures. |
| /factures/new | Public ou alias | Maquette legacy | Ancien écran statique sans persistance ; les vraies factures sont sous /facturation/factures. |
| /fournisseurs | Public ou alias | Redirection | Alias de compatibilité ou étape redirigée. |
| /invitation | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /invitation/complete | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /livraisons | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /livraisons/[id] | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /livraisons/[id]/edit | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /livraisons/new | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /login | Authentification | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /mentions-legales | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /mot-de-passe-oublie | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /onboarding/choix-abonnement | Onboarding | Redirection | Alias de compatibilité ou étape redirigée. |
| /onboarding/demarrage | Onboarding | Redirection | Alias de compatibilité ou étape redirigée. |
| /onboarding/entreprise | Onboarding | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /onboarding/formule | Onboarding | Redirection | Alias de compatibilité ou étape redirigée. |
| /onboarding/inscription | Onboarding | Redirection | Alias de compatibilité ou étape redirigée. |
| /onboarding/modules | Onboarding | Redirection | Alias de compatibilité ou étape redirigée. |
| /onboarding/paiement | Onboarding | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /onboarding/societe | Onboarding | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /outils | Outils | Écran réservé | Outils d'administration, import, export et audit. |
| /outils/audit-log | Outils | Écran réservé | Historique des actions sensibles et changements metier. |
| /outils/import-export | Outils | Écran réservé | Imports et exports de donnees metier. |
| /paiements | Public ou alias | Écran réservé | Encaissements, rapprochements et statut facture. |
| /parametres | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/abonnement | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/documents | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/entreprise | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/facturation | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/modules | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/numerotation | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/preferences | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/profil | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/roles | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/securite | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /parametres/utilisateurs | Paramètres | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /pricing | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rapports | Rapports | Écran réservé | Rapports avancés à connecter ; aucune analyse interactive fournie. |
| /reinitialiser-mot-de-passe | Public ou alias | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /relances | Public ou alias | Écran réservé | Relances clients planifiees selon echeances et retards. |
| /rh | RH | Redirection | Alias de compatibilité ou étape redirigée. |
| /rh/absences | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/attestations | RH | Écran descriptif | Cartes statiques ; aucun formulaire de checklist ou de génération de document dans cet écran. |
| /rh/avances | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/cnss | RH | Préparatoire | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/conges | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/contrats | RH | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rh/contrats/[id] | RH | Écran descriptif | Affiche seulement l’identifiant de route et une notice ; aucune lecture du contrat ou formulaire de détail. |
| /rh/contrats/new | RH | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rh/dashboard | RH | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rh/discipline | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/documents | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/employes | RH | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rh/employes/[id] | RH | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rh/employes/[id]/edit | RH | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rh/employes/new | RH | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /rh/evaluations | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/ir | RH | Préparatoire | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/notes-de-frais | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/offboarding | RH | Écran descriptif | Cartes statiques ; aucun formulaire de checklist ou de génération de document dans cet écran. |
| /rh/onboarding | RH | Écran descriptif | Cartes statiques ; aucun formulaire de checklist ou de génération de document dans cet écran. |
| /rh/paie | RH | Préparatoire | Page et composants métier présents ; voir preuves de tests séparées. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/paie/bulletins | RH | Préparatoire | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/paie/bulletins/[id] | RH | Préparatoire | Page et composants métier présents ; voir preuves de tests séparées. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/paie/bulletins/[id]/print | RH | Préparatoire | Page et composants métier présents ; voir preuves de tests séparées. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/paie/periodes | RH | Préparatoire | Page et composants métier présents ; voir preuves de tests séparées. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/paie/periodes/[id] | RH | Préparatoire | Page et composants métier présents ; voir preuves de tests séparées. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/paie/periodes/new | RH | Préparatoire | Page et composants métier présents ; voir preuves de tests séparées. Calculs et déclarations sociaux/fiscaux non certifiés. |
| /rh/parametres | RH | Consultation RH | Référentiels et paramètres affichés ; aucun formulaire de réglage sur cet écran. |
| /rh/presences | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /rh/prets | RH | Consultation RH | Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran. |
| /stock | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /stock/ajustements/new | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /stock/emplacements | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /stock/emplacements/[id] | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /stock/emplacements/[id]/edit | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /stock/emplacements/new | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /stock/entrees/new | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /stock/inventaire | Stock | Écran réservé | Ajustements valides avec impact stock. |
| /stock/mouvements | Stock | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tiers | Tiers | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tiers/[id] | Tiers | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tiers/[id]/edit | Tiers | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tiers/clients | Tiers | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tiers/fournisseurs | Tiers | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tiers/new | Tiers | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tiers/prospects | Tiers | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/comptes | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/comptes/[id] | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/comptes/[id]/edit | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/comptes/new | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/consultation | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/mouvements | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/mouvements/[id] | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/mouvements/new | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/previsions | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/previsions/[id]/edit | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/previsions/export | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/previsions/nouveau | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/rapprochement | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/releves | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/releves/[id] | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /tresorerie/releves/import | Trésorerie | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/commandes | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/commandes/[id] | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/commandes/[id]/edit | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/commandes/[id]/livrer | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/commandes/[id]/print | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/commandes/new | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/devis | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/devis/[id] | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/devis/[id]/edit | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/devis/[id]/print | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/devis/new | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/livraisons | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/livraisons/[id] | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/livraisons/[id]/print | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/livraisons/[id]/retour | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/livraisons/new | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/retours | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/retours/[id] | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
| /vente/retours/[id]/print | Ventes | Implémentation présente | Page et composants métier présents ; voir preuves de tests séparées. |
