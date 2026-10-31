# Felexia

Felexia Pro est un ERP SaaS pour PME marocaines. La version de lancement se concentre sur les factures de vente et d'achat, leurs règlements, la trésorerie et les journaux comptables. Les autres modules sont conservés et proposés sur demande.

## Version légère de lancement — 31 octobre 2026

### Compteurs de numérotation

`/parametres/numerotation` affiche les séries réellement utilisées : factures et avoirs clients, règlements clients/fournisseurs, factures fournisseurs, codes clients/fournisseurs et numéros annuels des journaux. Les autres documents commerciaux et les prospects apparaissent dans le profil ERP complet. La période mensuelle peut être sélectionnée ; les écritures suivent l'année de leur date comptable.

Un propriétaire ou administrateur peut saisir un prochain compteur entier, un motif, vérifier l'aperçu avant/après puis confirmer. Le serveur vérifie le rôle et l'entreprise de la session ; PostgreSQL vérifie à nouveau les droits, le dernier numéro utilisé et la révision du compteur. Une création simultanée provoque une demande d'actualisation, plutôt qu'un écrasement silencieux. Les formats existants sont conservés ; la longueur minimale de cinq chiffres peut croître au-delà de 99 999.

**Prérequis de publication : appliquer intégralement `supabase/migrations/097_document_numbering_controls.sql`, puis obtenir `numerotation_097_active = true` avec la requête de vérification finale.** Les cinq chemins de création d'écritures comptables de cette version délèguent leur numéro au nouveau déclencheur PostgreSQL. Ne pas publier ce code avant la migration.

Le 31/10/2026, l'utilisateur a appliqué 097 et confirmé cette vérification. La lecture authentifiée du projet public a ensuite validé 23/23 contrôles : contrat réel, protections des rôles/entreprises et finances QA intactes. L'écran connecté affiche 12 compteurs essentiels dans l'entreprise de test ; une correction 3 → 4 puis sa restauration 4 → 3 ont été enregistrées avec leurs motifs et leur administrateur. Le minimum déjà utilisé est refusé, les filtres et le changement de période fonctionnent, et la vue mobile ne déborde pas.

La migration ne renumérote aucun document et ne remet aucun compteur à zéro. Elle consolide les mécanismes d'attribution dans des transactions verrouillées, journalise les corrections et conserve les numéros connus lors des changements et suppressions. Les documents annulés ou archivés restent dans le calcul du minimum. Le registre peut reprendre les documents encore présents à l'installation ; il ne peut pas reconstituer des numéros dont toute trace avait déjà été supprimée avant cette migration. Les paramètres d'apparence des factures ne modifient plus les compteurs.

Contrôles : `npx tsx scripts/verify-numbering-model.ts` pour le contrat UI et les entrées, puis les tests PostgreSQL fonctionnels et concurrents documentés dans `training/numbering-counters/20261031/QA-POSTGRES.md`. Sauvegarde source antérieure vérifiée : `../backups/felexia-pro-before-numbering-20261031.bundle`, branche `codex/backup-before-numbering-20261031`.

### États de sortie professionnels

Tous les aperçus imprimables partagent la charte A4 de `src/styles/print.css` : identité de l'entreprise, références, tableaux avec en-têtes répétés, devise explicite, TVA, total puis règlements, notes, signatures et pagination. Le journal utilise le paysage ; les documents commerciaux utilisent le portrait. L'aperçu reste clair quel que soit le thème de l'application. Un logo d'entreprise est utilisé lorsqu'il est renseigné ; sinon un monogramme de l'entreprise le remplace.

L'aperçu s'ajuste à la largeur de l'écran, avec un bouton **Taille réelle / Ajuster à l'écran** pour lire les détails, notamment sur mobile. Cet ajustement n'affecte pas les dimensions de la feuille imprimée.

Les règlements fournisseurs disposent désormais d'un justificatif imprimable depuis leur fiche. Les prévisions de trésorerie ont un aperçu dédié qui conserve les filtres et n'imprime pas la navigation. L'export du journal compatible Excel est harmonisé ; les CSV et fichiers fiscaux conservent leur structure d'échange. Le bulletin RH existant reste un document préparatoire.

Les formats et la confidentialité sont vérifiés par `npx tsx scripts/verify-print-outputs.tsx` (données fictives, sans base). Les preuves de pagination PDF, de montants en EUR, de remises et de documents longs sont décrites dans `training/premium-outputs/20261031/QA-PRINT.md`. Aucune migration n'est nécessaire. Sauvegarde préalable vérifiée : `../backups/felexia-pro-before-output-design-20261031.bundle`, branche `codex/backup-before-output-design-20261031`.

### Interface harmonisée

L’application utilise une palette bleu et bleu nuit, des surfaces blanches et des composants partagés dans `src/styles/interface.css`. La navigation, les boutons, les formulaires, les tableaux, les états vides et le tableau de bord suivent la même hiérarchie visuelle, avec adaptation mobile et mode sombre. Les tableaux de factures et de journaux regroupent les informations secondaires pour conserver les actions visibles sur ordinateur.

Les couleurs des boutons sont portées par `data-variant`, y compris pour les liens rendus avec `asChild`. Les règles de réinitialisation restent dans la couche CSS `base` : ne pas réintroduire un `a { color: inherit }` global hors couche. Les dimensions par défaut des boutons restent dans la couche `components`, afin que les tailles des boutons d’icône puissent les remplacer. Les styles publics et d’impression conservent leurs variantes dédiées.

Sauvegarde préalable : branche `codex/backup-ui-before-premium-20261031` et archive vérifiée `../backups/felexia-pro-before-premium-20261031.bundle`. Cette refonte ne nécessite aucune migration SQL. Contrôles et limites : `training/premium-interface/20261031/REPORT.md`.

### Profil Opérateur

Le profil **Opérateur** sert à la saisie quotidienne : clients, fournisseurs, factures de vente et d'achat, avoirs et règlements. Il peut consulter les comptes de trésorerie et les journaux. L'administration de l'entreprise, les utilisateurs, les habilitations, l'abonnement, la numérotation, la gestion des comptes bancaires et les écritures comptables restent hors de ce profil. Un règlement déjà comptabilisé doit être corrigé par l'administrateur.

Les migrations additives `supabase/migrations/095_operator_profile.sql` puis `096_fix_operator_contact_numbering.sql` doivent être appliquées avant de publier ce profil. Elles préparent le rôle pour les entreprises existantes et futures, sans attribuer ce rôle à aucun membre existant, et conservent l'autonumérotation des clients/fournisseurs. Un administrateur peut ensuite sélectionner **Opérateur** lors d'une invitation ou changer le rôle d'un équipier. Les restrictions sont contrôlées dans l'application et dans la base, y compris pour les appels directs.

Le serveur accepte aussi le champ `organizationId` d'un ancien formulaire d'invitation uniquement s'il correspond à l'entreprise issue de la session. Une entreprise différente reste refusée avant toute création ou tout envoi d'email.

Le menu principal propose six entrées : **Accueil, Ventes, Achats, Trésorerie, Journaux, Paramètres**.

- Créer son entreprise et renseigner ses informations de facturation.
- Créer ses clients et fournisseurs ; saisir directement des factures avec des lignes libres, sans catalogue obligatoire.
- Valider, imprimer et régler les factures ; affecter les règlements aux factures et choisir un compte bancaire ou une caisse.
- Consulter les soldes et les mouvements de trésorerie.
- Consulter, imprimer et exporter les journaux ; saisir et gérer les écritures depuis Journaux.
- Demander les modules complémentaires depuis **Paramètres → Modules sur demande** (email prérempli, envoi à effectuer par le client).

Stock, devis, commandes, livraisons/réceptions, RH, documents, prévisions, rapprochement bancaire et comptabilité avancée sont masqués. Les URL correspondantes conduisent vers la page de demande ; les anciens hubs ventes/achats/comptabilité conduisent vers les factures ou les journaux. Les avoirs restent accessibles pour corriger une facture. Les PDF et les données existantes restent conservés ; les opérations comptables et de trésorerie automatiques restent en place.

### Sauvegarde et retour à la version complète

Avant les modifications, l'état complet du code, y compris les corrections d'invitations en attente, a été sauvegardé au commit **`c6fd5c3`**, branche **`codex/backup-erp-complet-20261031`**. La version légère est développée sur **`codex/felexia-light-launch-20261031`**.

Une archive Git autonome est également conservée à `../backups/felexia-erp-complet-20261031.bundle`. Elle contient le code et son historique, sans les fichiers d'environnement ignorés. Cette archive est une sauvegarde du code ; les données Supabase restent dans la base existante. Aucune migration ni suppression de données n'est nécessaire pour activer l'interface légère.

La version légère possède sa propre archive : `../backups/felexia-pro-light-20261031.bundle`.

Le profil par défaut est léger sans nouvelle variable. L'exploitant peut configurer ces variables **serveur uniquement** dans l'environnement de déploiement :

```dotenv
# Valeur normale ; peut aussi être omise.
FELEXIA_ERP_MODE=light
# UUID des entreprises autorisées à retrouver l'interface complète, séparés par des virgules.
FELEXIA_FULL_ERP_ORGANIZATION_IDS=
```

Pour une demande acceptée, ajouter l'UUID de l'entreprise à `FELEXIA_FULL_ERP_ORGANIZATION_IDS`, puis redéployer. Pour rétablir l'interface complète pour toutes les entreprises, configurer `FELEXIA_ERP_MODE=full`, puis redéployer. Les droits d'abonnement existants continuent à s'appliquer ; les options RH restent soumises à ces droits. Le profil complet active l'ensemble de l'interface existante pour l'entreprise, sans réglage par module. Le retour au profil léger consiste à retirer l'UUID de la liste ou à retirer `full`.

La société active est résolue depuis la session et son membership. Aucun paramètre d'URL, de formulaire, de métadonnées utilisateur ou de stockage navigateur ne peut activer le profil complet. Ce profil règle la présentation et les parcours : il ne remplace ni les permissions métier ni les RLS Supabase. Les informations d'entreprise et les logos sur les factures conservent leur fonctionnement.

### Vérifications du lancement

```bash
npm run test:light-launch
npm run test:regressions
npm run typecheck
npm run lint -- src scripts/verify-light-launch.ts
npm run build
```

Le lint global inclut également les scripts historiques de `training/transaction-stress-test`, qui présentent des erreurs préexistantes. Le lint du code applicatif et des fichiers de cette version doit passer.

La première publication légère (`348e68f`) conservait les invitations historiques. Le contrôle réel du parcours nouvel abonné a ensuite conduit à publier `41d6796` : inscription corrigée, invitations réellement envoyées et acceptées, règlements partiels simplifiés et écritures corrigées. La migration 093 a été appliquée manuellement puis vérifiée en production.

Le test du rôle « Lecture seule » a révélé un droit de modification des factures. La migration additive `supabase/migrations/094_readonly_financial_documents.sql` corrige ce défaut sur 17 tables du lancement. Elle a été appliquée manuellement puis vérifiée avec le compte invité réel : modification refusée et note d'origine conservée. L'interface retire aussi les raccourcis de création pour ce rôle. Ces protections ne modifient ni les données ni les droits existants des autres rôles.

Le parcours financier de test passe 41 contrôles et la seconde inscription 14 contrôles. Les résultats, les limites et les étapes SMTP figurent dans [le rapport du parcours de lancement](training/launch-e2e/qa-20261031t131126/REPORT.md). Le SMTP personnalisé n'est pas encore configuré : la réception des invitations Gmail de test ne valide pas la livraison des emails au public.

## Stack

- Next.js App Router 16
- TypeScript
- Tailwind CSS 4
- Supabase Auth SSR avec `@supabase/ssr`
- Supabase PostgreSQL, RLS et migrations SQL
- Vercel ready

## Installation locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrez `http://localhost:3000/dashboard`.

## Variables d'environnement

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxx
# Alternative legacy acceptee si la publishable key n'est pas encore disponible:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxx
```

Utilisez une publishable key Supabase moderne. Une cle anon legacy reste acceptee en fallback, mais la publishable key est recommandee.

## Migration Supabase

Avec le CLI Supabase:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Ou depuis l'editeur SQL Supabase, executez:

```text
supabase/migrations/001_initial_schema.sql
```

## Seed de demonstration

Apres la migration, executez:

```text
supabase/seed.sql
```

Le seed cree l'organisation `Felexia Demo`, des tiers marocains, articles, TVA, devis, factures, paiement partiel, relance, stock et tresorerie.

## Creer un utilisateur Supabase Auth

1. Dans Supabase Dashboard, ouvrez Authentication > Users.
2. Creez un utilisateur avec email et mot de passe.
3. Copiez son `id`.
4. Ajoutez un profil et rattachez-le a l'organisation demo:

```sql
insert into profiles (id, full_name, email)
values ('USER_UUID', 'Admin Felexia', 'admin@example.com');

insert into organization_members (organization_id, user_id, role_id)
select
  '11111111-1111-1111-1111-111111111111',
  'USER_UUID',
  id
from roles
where organization_id = '11111111-1111-1111-1111-111111111111'
  and name = 'admin';
```

## Tester le login

1. Renseignez `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Creez un utilisateur dans Supabase Auth.
3. Ajoutez son profil et son rattachement a `organization_members` comme indique plus haut.
4. Lancez l'application:

```bash
npm run dev
```

5. Ouvrez `/login`, connectez-vous, puis verifiez la redirection vers `/dashboard`.

Les routes ERP redirigent vers `/login` sans session. Un utilisateur deja connecte qui ouvre `/login` est redirige vers `/dashboard`.

## Fonctionnel dans cette version

- Layout ERP professionnel avec sidebar, topbar et navigation modules.
- Routes demandees creees.
- Pages fonctionnelles: dashboard, tiers, clients, fournisseurs, articles, devis, factures, stock, tresorerie, rapports, parametres.
- Composants reutilisables: Button, Input, Textarea, Select, Badge, Card, StatCard, Table, EmptyState, PageHeader, AppShell, Sidebar, Topbar, StatusBadge, MoneyDisplay.
- Schema PostgreSQL multi-tenant avec `organization_id`, RLS, vues dashboard, triggers, numerotation, audit simple et fonctions stock/paiement.

## Limites V1

- Les pages utilisent encore des donnees de demonstration TypeScript pour garantir une interface testable sans projet Supabase connecte.
- Les formulaires ne mutent pas encore la base.
- La generation PDF et la facturation electronique marocaine sont preparees conceptuellement, pas implementees.
- Les workflows metier avances restent a coder cote Server Actions.

## Prochaine etape recommandee

Brancher les pages liste/detail sur Supabase via Server Components, ajouter les Server Actions de creation tiers/articles/documents, puis verrouiller les documents valides dans la couche applicative en plus des triggers SQL.
