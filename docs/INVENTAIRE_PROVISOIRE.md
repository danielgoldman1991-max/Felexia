# Inventaire des écrans et fonctions encore provisoires

État lu sur `main` (`5aec3a4`, migrations jusqu'à 122) puis mis à jour au fil des correctifs. Une fonction « préparatoire » reste utilisable : elle ne simule pas un dépôt officiel et ne remplace pas le conseil fiscal, social ou comptable.

Légende des décisions : **implémenté** (parcours réel dans l'application), **laissé** (volontairement, avec la raison).

## Ressources humaines

| Élément | Fichier | État avant | Décision |
| --- | --- | --- | --- |
| Validation des congés | `src/app/rh/conges`, `src/lib/hr/leave-actions.ts` | Création en `pending`, colonnes d'approbation inutilisées | **Implémenté.** Acceptation, refus, annulation, décompte du solde, notification in-app, historique (`hr_leave_decisions`, migration 123). |
| Solde de congés | `src/lib/hr/leave-balance.ts`, `/rh/conges/soldes` | Recalcul manuel global | **Implémenté** à chaque décision, le recalcul global reste disponible. Acquisition 1,5 jour par mois (18 jours/an). |
| Attestations | `src/app/rh/attestations` | Cartes « génération à venir », menu masqué | **Implémenté.** Impression attestation de travail, de salaire et certificat de travail depuis le dossier. Pas de signature qualifiée. |
| Fin de contrat et solde de tout compte | `src/app/rh/contrats/[id]`, `/rh/offboarding` | Fiche contrat en lecture, checklist statique | **Implémenté.** Clôture du contrat, sortie du salarié, calcul préparatoire (congés / 26, préavis, article 53 en heures / 191) et impression. Table `hr_final_settlements`. |
| Arrivées | `src/app/rh/onboarding` | Checklist non enregistrée | **Implémenté.** Points cochés dans `hr_employee_checks`. Ne crée aucun accès. |
| Absences, présences, avances, prêts, notes de frais | pages `/rh/absences`, `/rh/presences`, `/rh/avances`, `/rh/prets`, `/rh/notes-de-frais` | Listes sans formulaire | **Implémenté.** Création et changement de statut. Le paiement n'écrit pas tout seul en trésorerie. Pas de pointeuse. |
| Détail de contrat | `src/app/rh/contrats/[id]` | Déjà lu en base depuis les PR précédentes | Conservé, plus l'action de clôture. |
| Paie, CNSS/AMO, IR | `/rh/paie`, `/rh/cnss`, `/rh/ir` | Calcul 2026, BDS et état 9421 téléchargeables, explicitement préparatoires | **Laissé** en préparatoire. Le barème et le dépôt Damancom / EDI IR exigent une validation sociale. Les fichiers sont complétés dans la PR fiscale sans simuler le dépôt. |
| Évaluations, discipline, documents RH, paramètres de barème | `/rh/evaluations`, `/rh/discipline`, `/rh/documents`, `/rh/parametres` | Consultation | **Laissé.** Les pièces jointes passent par le module Documents. Modifier le barème IR en écran libre sans versionnage réglementaire serait plus risqué que de le laisser en lecture. |
| Pointeuse et accès informatiques | — | Annoncés nulle part comme livrés | **Laissé.** Aucun connecteur de badge ni provisioning d'annuaire. |

## Comptabilité et trésorerie

| Élément | Fichier | État avant | Décision |
| --- | --- | --- | --- |
| Liasse CGNC | `src/lib/accounting/liasse.ts`, `/comptabilite/liasse` | Quatre totaux, 5 000 lignes, capitaux d'ouverture à 0, pas d'export | **À compléter** dans la PR comptabilité : postes, impression, Excel. Reste une liasse de gestion, pas une liasse certifiée. |
| Bilan et CPC | `/comptabilite/etats` | Synthèse des classes 1 à 7 | Conservé comme synthèse. Le détail est sur la liasse. |
| FEC | `/comptabilite/fec` | Texte tabulé, journal forcé à OD, plafond 5 000 | **À compléter** : code journal réel et lecture paginée. Reste un export de type FEC, pas un dépôt. |
| Lettrage comptable | `/comptabilite/lettrage` | 3421 / 4411 | Déjà en place. |
| Déclaration TVA | `/comptabilite/tva` | CRUD, contrôle, XML/CSV préparatoires vers Storage | Déjà en place, non homologué DGI. |
| EDI SIMPL | `/comptabilite/tva/edi-simpl` | Fichier vide hors en-tête | **À brancher** sur les lignes de déclaration. Pas de télé-dépôt. |
| Excel TVA DGI | `src/lib/tax/dgi-vat-xlsx.ts` | `DGI_VAT_XLSX_AVAILABLE = false` | **Laissé.** Le XML et le CSV préparatoires existent. Ajouter une dépendance tableur n'apporte pas le schéma DGI. |
| Relevés et rapprochement | `/tresorerie/releves`, `/tresorerie/rapprochement` | Import CSV, suggestions, lettrage des lignes. Annulation renvoyée « prochaine itération ». Menu visible. | **À compléter** : OFX/QFX et annulation d'un rapprochement (`status = cancelled`, déjà prévu en base). |
| Prévisions de trésorerie | `/tresorerie/previsions` | Opérationnel | Conservé. |
| Page Exports comptables | `/comptabilite/exports` | Liens vers les vrais exports | Conservée comme index, sans promettre un FEC depuis cette seule page. |

## Fiscal et social — dépôt

| Élément | Fichier | Décision |
| --- | --- | --- |
| Identifiants de dépôt DGI / CNSS | pas d'écran dédié | **À ajouter** : paramètres (affiliation, régime, taux d'IS saisi). Aucun mot de passe Damancom ni jeton DGI stocké. |
| SIMPL TVA, état 9421, BDS | bibliothèques existantes | **À contrôler** (ICE, période, totaux, jours, plafond). Le fichier se télécharge. Le dépôt en ligne reste manuel. |
| IS | absent | **À ajouter** comme préparation à partir du résultat comptable et d'un taux saisi. Pas de taux légal inventé. |
| Télé-dépôt DGI, Damancom, signature qualifiée, facturation électronique officielle | `docs/e-invoicing` | **Laissé.** Identifiants, certificats et homologation officiels requis. Felexia ne simule pas un accusé de dépôt. |

## Stock, ventes, achats, CRM

| Élément | Fichier | Décision |
| --- | --- | --- |
| Inventaire physique | `/stock/inventaire/sessions` | Déjà livré (migration 122). Les textes vitrine qui disent encore « à venir » sont **à corriger**. |
| Agenda, tâches, rappels, échéances, relances legacy | `src/app/agenda/*`, `src/app/relances` | Placeholders. **À remplacer** par les échéances déjà en base (factures, contrats, congés). Pas un second calendrier. |
| Anciennes maquettes | `/avoirs`, `/banques`, `/caisses`, `/encaissements`, `/decaissements`, `/paiements` | Placeholders alors que les écrans réels existent. **À rediriger.** |
| GED archives / modèles / pièces jointes | `/documents/archives`, `/documents/modeles`, `/documents/pieces-jointes` | Placeholders. Le module `/documents` et son import existent. **À rediriger.** |
| Outils | `/outils`, `/outils/import-export` | Placeholders. Le journal d'audit `/outils/audit-log` est réel. |
| Rapports avancés | `/rapports` | Vide « à venir ». **À remplacer** par un index des rapports déjà produits (balance, journaux, TVA, trésorerie). Pas une suite analytique nouvelle. |
| CRM | menu masqué, fiches tiers réelles | Les fiches clients, prospects et le pipeline sont livrés. Le menu CRM groupé reste masqué : les entrées sont déjà sous Ventes et Tiers. **Laissé** pour ne pas dupliquer la navigation. |
| Demandes et consultations d'achat, retenues | `/achats/demandes`, `/achats/consultations` | Déjà livrés sur les PR précédentes. La retenue à la source reste un calcul préparatoire, pas une déclaration. |

## Vitrine et contenu

Les pages `/pro`, tarifs, articles et base d'aide décrivent encore l'inventaire, l'agenda et les attestations comme non livrés. **À aligner** sur le périmètre réel, sans annoncer de dépôt DGI ou de paie certifiée.

## Hors produit, laissés tels quels

- Paiement Stripe réel et e-mails : dépendent des comptes déjà configurés, pas d'un écran manquant.
- ICE, RC, IF, CNSS de l'éditeur Felexia Conseils sur les mentions légales : données non fournies, lignes masquées. Ne pas les inventer.
- Réseaux sociaux autres qu'Instagram : pas d'URL officielle connue.
