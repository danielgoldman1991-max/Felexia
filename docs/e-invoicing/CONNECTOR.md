# Connecteur : état réel et évolution

## Périmètre disponible

`src/lib/e-invoicing/connector.ts` expose une interface de préparation locale et un simulateur interne. Il ne possède ni adresse d’API DGI, ni identifiant fiscal de connexion, ni certificat, ni clé privée. Il n’ouvre aucune connexion réseau.

| Mode | Validation et préparation locales | Transmission |
| --- | --- | --- |
| `disabled` | Disponibles selon les droits et la configuration du module | Refus `CONNECTOR_DISABLED` |
| `simulation` | Disponibles | Résultat interne fictif, explicitement marqué |
| `official` | Préparation générique possible dans le domaine | Refus `DGI_OFFICIAL_SPECIFICATIONS_UNAVAILABLE` |

La base n’autorise dans la configuration que `disabled` et `simulation`. La capacité `officialConnection` vaut toujours `false`, comme la capacité `signature`. L’appel `sign()` échoue systématiquement avec `SIGNATURE_PROVIDER_NOT_CONFIGURED`.

Un XML préparé contient un identifiant de personnalisation **Felexia générique et préparatoire**, sans usurper un profil marocain officiel. La disponibilité du format UBL2.1 n’implique pas qu’il soit le profil retenu par une future procédure nationale.

## Opérations de l’interface

- `validate(input, options)` contrôle les données et les montants.
- `prepare(input, options)` produit le snapshot normalisé, le XML UBL, le XML canonique et leurs empreintes, après validation XSD.
- `sign()` est réservé et désactivé.
- `submit(artifact, request)` fonctionne uniquement en simulation.
- `getStatus`, `getAcknowledgement` et `reconcile` consultent ou vérifient un reçu de simulation ; ils ne demandent aucun état à une autorité.

Le reçu est marqué `simulation: true`, `authority: FELEXIA_INTERNAL_SIMULATION` et sa référence commence par `SIMULATED-`. Son texte précise qu’il ne s’agit ni d’une transmission, ni d’un accusé DGI. Les états acceptation, rejet, attente ou inconnu sont exclusivement ceux de cet essai interne.

## Reprises et idempotence

Le simulateur de domaine reconnaît une même clé d’opération et refuse son réemploi avec une empreinte documentaire différente. Son registre en mémoire n’est pas une file durable. Les méthodes acceptent également un reçu persisté pour sa vérification ; elles ne prétendent pas authentifier cryptographiquement un accusé fiscal externe.

La durabilité appartient à la base : `einvoice_enqueue_simulation`, `einvoice_claim_jobs` et `einvoice_finish_job` gèrent l’opération persistée, le verrouillage, la durée de bail, le jeton de tentative et les reprises bornées. Une réponse perdue peut être rejouée avec la même clé ; un ancien bail ne peut clôturer une tentative plus récente. La base limite les reprises à trois tentatives et conserve les échecs ou états inconnus. Un travail ne doit jamais être déclaré accepté sur la seule absence d’une exception réseau.

`einvoice_due_organizations` réserve au rôle service la découverte des entreprises ayant réellement un travail dû, selon la disponibilité ou l’expiration du bail. La sélection tient compte du module, du mode simulation et de l’abonnement : les entreprises sans travail dû ne consomment pas la limite du lot. Un travail dont l’acteur a perdu son autorisation est clôturé en échec explicite et audité, sans empêcher les suivants d’avancer. Avant une simulation, le worker relit les octets XML et PDF et vérifie leurs empreintes ; la seule présence de métadonnées d’archives ne suffit pas.

Les scénarios SQL sont `accept`, `reject`, `timeout`, `unavailable`. Le domaine emploie respectivement `accepted`, `rejected`, `timeout`, `temporary_failure`. L’orchestrateur serveur doit expliciter cette correspondance. Les tests isolés couvrent acceptation, rejet, indisponibilité temporaire, dépassement de délai, clé réutilisée et reprise. Aucun scénario ne crée un paiement, un nouveau numéro de facture ou une nouvelle écriture comptable.

## Branchements futurs : conditions préalables

Un connecteur officiel requiert d’abord des publications vérifiées donnant le profil documentaire, les règles de validation, le protocole, les environnements, l’authentification, les accusés, les reprises, les limites et les modalités d’homologation applicables. Les noms d’endpoints et les statuts officiels ne doivent pas être déduits des noms de ce simulateur.

L’activation devra être indépendante de la simple disponibilité d’une URL : configuration par entreprise, contrôle de l’environnement de test ou de production, qualification du prestataire, tests d’interopérabilité et autorisation explicite de l’exploitant. Le schéma SQL actuel devra évoluer pour autoriser volontairement un mode officiel ; aucune valeur de formulaire ne le débloque aujourd’hui.

## Signature : références, jamais clés privées dans l’application

Le contrat futur de fournisseur de signature reçoit une référence de prestataire et de certificat, le contenu ou son empreinte selon le protocole vérifié, et le contexte autorisé. Les types réservent des références de certificat et ne déclarent aucune qualification acquise. Le fournisseur doit produire la signature et les éléments de preuve pertinents ; l’application doit vérifier le résultat avant de l’archiver comme signé.

Les clés privées doivent rester dans le dispositif du prestataire, un HSM ou un service de clés adapté à la procédure retenue. Elles ne doivent pas être ajoutées aux options JSON, à la base documentaire, aux variables publiques, au navigateur, aux rapports ou aux journaux. Une référence de clé n’est pas la clé elle-même. Toute future donnée sensible de connexion exige un stockage serveur adapté, un périmètre minimal, une rotation et une traçabilité.

Le format de signature, le niveau de certificat, les chaînes de confiance, la révocation et l’horodatage doivent suivre les spécifications applicables effectivement publiées. Ni XAdES, ni un type de certificat, ni une qualification juridique ne sont imposés ici sur la seule présence de schémas XMLDSig/XAdES dans les dépendances UBL.

## Sources techniques et preuves

Les schémas sont issus du jeu [OASIS UBL2.1](https://docs.oasis-open.org/ubl/os-UBL-2.1/UBL-2.1.html), avec les racines [Invoice](https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-Invoice-2.1.xsd) et [CreditNote](https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-CreditNote-2.1.xsd). La canonicalisation suit [C14N1.1 du W3C](https://www.w3.org/TR/xml-c14n11/). Le validateur utilisé est [libxml2-wasm](https://github.com/jameslan/libxml2-wasm), version0.7.2 épinglée.

Le manifeste local documente les URL, tailles et SHA256 des quinze fichiers. `training/e-invoicing/20261031/domain-tests.json` rapporte 55 contrôles et zéro requête réseau observée. `SECURITY.md` décrit les garanties, les preuves SQL et la limite explicite de la préproduction à authentification simulée. Aucun de ces documents ne constitue une attestation d’acceptation ou de conformité DGI.
