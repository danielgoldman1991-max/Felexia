# Utiliser la facturation électronique préparatoire

## Préparer son entreprise

Un administrateur active le module une fois que l’exploitant l’a autorisé pour son entreprise. Dans **Mon entreprise**, renseigner les informations réelles : raison sociale, adresse, pays, ICE et identifiant fiscal. Le registre de commerce peut être exigé par le paramètre de l’entreprise ; ce réglage ne dispense pas de vérifier les obligations applicables à son activité.

Dans **Ventes → Facturation électronique → Configuration**, choisir la catégorie habituelle de client, la langue et les alertes. Le connecteur peut rester désactivé : la préparation et l’archivage internes restent utilisables. Le mode simulation ajoute uniquement des essais internes. Aucune connexion officielle DGI n’est disponible.

## Facture ou avoir

1. Créer puis valider la facture ou l’avoir dans la facturation habituelle. Le module réutilise son numéro et ses montants ; il ne transforme pas un brouillon commercial en facture validée.
2. Ouvrir la pièce dans **Facturation électronique**. Vérifier le type du client : professionnel, particulier ou export.
3. Pour chaque ligne, préciser l’unité. Pour une TVA nulle, choisir explicitement la catégorie et indiquer le motif réel : taux zéro, exonération ou hors champ. Le logiciel ne déduit pas une exonération de la seule présence d’un taux zéro.
4. Cliquer **Préparer**. Les calculs, données, caractères XML et schémas sont contrôlés. Les erreurs sont conservées et affichées. Une préparation invalide ne produit pas un faux PDF/XML valide.
5. Si les contrôles réussissent, consulter le PDF et télécharger le XML. Vérifier les noms, adresses, dates, références et montants.
6. **Valider**, puis **Émettre** après confirmation. L’émission fige cette version. Pour une correction après émission, utiliser la procédure de correction/avoir autorisée au lieu de modifier silencieusement l’original.
7. Marquer **Prêt à transmettre** si nécessaire. Ce statut est interne et ne vaut pas transmission fiscale.

Un avoir client conserve la référence de sa facture d’origine et son motif. Les factures fournisseurs reçues ne sont pas réémises au nom de l’entreprise dans cette première version.

## Comprendre les états

| État | Sens |
|---|---|
| À préparer | Aucune version électronique enregistrée |
| Brouillon | Version capturée, éventuellement incomplète ; contrôles à consulter |
| Validée | Contrôles internes réussis pour cette version |
| Émise | Document figé et archives conservées |
| Prête | Document émis, prêt pour un traitement ultérieur |
| Simulation : attente / acceptée / rejetée / inconnue | Résultat fictif interne, aucune décision DGI |

Les paiements, soldes commerciaux et écritures comptables continuent de suivre leur parcours habituel. Le PDF fiscal archivé conserve le montant TTC émis ; il ne devient pas un relevé de solde recalculé à chaque règlement.

## Versions et changements

Avant émission, une nouvelle préparation crée une nouvelle version. Les anciennes restent consultables. Un changement des coordonnées fiscales, des lignes ou des règles fiscales entre préparation et émission impose de préparer à nouveau. Un simple changement de langue, d’alertes ou de mode du connecteur n’invalide pas les faits fiscaux.

Après émission, l’impression habituelle de la facture/avoir renvoie le PDF archivé. Les modifications ultérieures des coordonnées du client ou de l’entreprise ne changent pas l’archive émise. Chaque téléchargement contrôle l’empreinte des octets.

## Qui peut faire quoi ?

| Profil | Droits du module |
|---|---|
| Administrateur/propriétaire | Préparation, émission, réglages, simulation, contrôle d’intégrité et supervision |
| Opérateur | Consultation, préparation, validation, émission, passage à prêt et téléchargements |
| Lecture seule | Consultation et téléchargement des archives accessibles à son entreprise |

Un abonnement permettant seulement la consultation conserve l’accès aux archives, mais interdit les nouvelles opérations. Les droits sont également contrôlés en base, indépendamment des boutons affichés.

## Supervision et incidents

L’administrateur consulte les tâches en attente, reprises, rejets simulés, contrôles d’intégrité et liens comptables. Les reprises utilisent une file persistante ; ne pas recréer une facture pour contourner un incident. Le numéro et la version de la pièce permettent de retrouver l’historique. Une alerte d’intégrité nécessite l’examen des archives et du justificatif de restauration.

La rubrique sauvegarde enregistre une **déclaration humaine documentée** d’un contrôle de restauration. Elle ne lance pas et ne certifie pas une sauvegarde de l’hébergeur. La veille compare des publications publiques et demande une revue humaine ; elle ne modifie jamais les règles fiscales automatiquement.
