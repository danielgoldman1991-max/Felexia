# Felexia

Felexia est une fondation de mini-ERP SaaS B2B pour PME marocaines: tiers, articles, ventes, achats, stock, tresorerie, reporting et parametrage societe.

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
