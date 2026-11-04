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
| Liasse CGNC | `src/lib/accounting/liasse.ts`, `/comptabilite/liasse` | Quatre totaux, 5 000 lignes, pas d'export | **Implémenté** comme liasse de gestion : postes, impression, Excel. Capitaux d'ouverture non repris d'un bilan N-1. Pas une liasse certifiée. |
| FEC | `/comptabilite/fec` | Journal forcé à OD, plafond 5 000 | **Implémenté** : code journal réel, lecture paginée jusqu'à 20 000 lignes. Export de type FEC, pas un dépôt. |
| Relevés et rapprochement | `/tresorerie/releves`, `/tresorerie/rapprochement` | CSV seulement, annulation absente | **Implémenté** : OFX/QFX et annulation (`status = cancelled`). |
| Bilan et CPC | `/comptabilite/etats` | Synthèse des classes 1 à 7 | Conservé comme synthèse. Le détail est sur la liasse. |
| Lettrage comptable | `/comptabilite/lettrage` | 3421 / 4411 | Déjà en place. |
| Déclaration TVA | `/comptabilite/tva` | CRUD, contrôle, XML/CSV préparatoires vers Storage | Déjà en place, non homologué DGI. |
| EDI SIMPL | `/comptabilite/tva/edi-simpl` | Fichier vide hors en-tête | **Implémenté** dans la section fiscale : lignes réelles et contrôles, sans télé-dépôt. |
| Excel TVA DGI | `src/lib/tax/dgi-vat-xlsx.ts` | `DGI_VAT_XLSX_AVAILABLE = false` | **Laissé.** Le XML et le CSV préparatoires existent. Ajouter une dépendance tableur n'apporte pas le schéma DGI. |
| Prévisions de trésorerie | `/tresorerie/previsions` | Opérationnel | Conservé. |
| Page Exports comptables | `/comptabilite/exports` | Liens vers les vrais exports | Conservée comme index, sans promettre un FEC depuis cette seule page. |

## Fiscal et social — dépôt

| Élément | Fichier | Décision |
| --- | --- | --- |
| Identifiants de dépôt DGI / CNSS | `/comptabilite/parametres-fiscaux` | **Implémenté.** Affiliation, périodicité, taux d'IS saisi, note. Aucun mot de passe ni dépôt. Migration 124. |
| SIMPL TVA | `/comptabilite/tva/edi-simpl` | **Implémenté** à partir des lignes de déclaration, avec contrôles ICE, période et cohérence des taux. Téléchargement seulement. |
| BDS et état 9421 | `/rh/cnss/bds`, `/rh/ir/etat-9421` | **Contrôles ajoutés** (CNSS, jours, plafond, CIN, IR). Le format reste préparatoire, pas un dépôt Damancom ou EDI. |
| IS | `/comptabilite/is` | **Implémenté** depuis le résultat comptable et le taux saisi. Pas de taux légal inventé, pas de liasse fiscale officielle. |
| Télé-dépôt DGI, Damancom, signature qualifiée, facturation électronique officielle | `docs/e-invoicing` | **Laissé.** Identifiants, certificats et homologation officiels requis. Felexia ne simule pas un accusé de dépôt. |

## Stock, ventes, achats, CRM

| Élément | Fichier | Décision |
| --- | --- | --- |
| Inventaire physique | `/stock/inventaire/sessions` | Déjà livré (migration 122). Les textes vitrine faux ont été alignés. |
| Agenda | `src/app/agenda` | **Implémenté** à partir des factures ouvertes, et des contrats ou congés en PRO. |
| Anciennes maquettes | `/avoirs`, `/banques`, `/caisses`, `/encaissements`, `/decaissements`, `/paiements`, `/relances` | **Redirigées** vers les écrans réels. |
| GED archives / modèles / pièces jointes | `/documents/archives`, `/documents/modeles`, `/documents/pieces-jointes` | **Redirigées** vers `/documents`. |
| Outils | `/outils`, `/outils/import-export` | **Redirigés** vers le journal d'audit et l'import de documents. |
| Rapports | `/rapports` | **Implémenté** comme index des états existants. Pas de suite analytique nouvelle. |
| CRM | menu masqué, fiches tiers réelles | Les fiches clients, prospects et le pipeline sont livrés. Le menu CRM groupé reste masqué : les entrées sont déjà sous Ventes et Tiers. **Laissé** pour ne pas dupliquer la navigation. |
| Demandes et consultations d'achat, retenues | `/achats/demandes`, `/achats/consultations` | Déjà livrés sur les PR précédentes. La retenue à la source reste un calcul préparatoire, pas une déclaration. |

## Vitrine et contenu

Les pages publiques ont été alignées sur ce périmètre : inventaire, agenda, attestations et liasse de gestion sont décrits comme disponibles. Le dépôt DGI, Damancom et la paie certifiée ne sont pas annoncés.

## Hors produit, laissés tels quels

- Paiement Stripe réel et e-mails : dépendent des comptes déjà configurés, pas d'un écran manquant.
- ICE, RC, IF, CNSS de l'éditeur Felexia Conseils sur les mentions légales : données non fournies, lignes masquées. Ne pas les inventer.
- Réseaux sociaux autres qu'Instagram : pas d'URL officielle connue.
