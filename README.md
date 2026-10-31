# Felexia

Felexia Pro est un ERP SaaS pour PME marocaines. La version de lancement se concentre sur les factures de vente et d'achat, leurs règlements, la trésorerie et les journaux comptables. Les autres modules sont conservés et proposés sur demande.

## Version légère de lancement — 31 octobre 2026

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

La release de production `codex/felexia-light-production-20261031` est basée sur `origin/main` et conserve son système d'invitations. La refonte d'invitations sauvegardée dans `c6fd5c3` reste sur la branche de travail : sa migration 093 n'étant pas appliquée en production, elle est exclue de cette publication. La version légère ne demande aucune nouvelle migration et conserve la configuration de production existante (Supabase, Stripe, domaine et hébergement Vercel).

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
