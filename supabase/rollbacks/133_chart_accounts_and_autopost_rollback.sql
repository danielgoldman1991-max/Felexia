alter table public.accounting_settings drop column if exists auto_post_on_validation;

-- Deletes only the accounts inserted by migration 133.
-- Marker: supabase_migrations.schema_migrations version 20261104185626
-- (rows inserted at 2026-11-04 18:56:26.148821+00). A pre-existing account
-- that merely shares a code (2832, 2833, 2834, 2835, 34552, 6193, …)
-- has an earlier created_at and is kept. The 6193 label correction is
-- not reversed, because those rows were not created by this migration.
delete from public.accounting_accounts a
where a.is_system is true
  and a.created_at >= timestamptz '2026-11-04 18:56:26+00'
  and (a.code, a.name) in (
    ('2831', 'Amortissements des terrains'),
    ('2832', 'Amortissements des constructions'),
    ('2833', 'Amortissements des installations techniques, matériel et outillage'),
    ('2834', 'Amortissements du matériel de transport'),
    ('2835', 'Amortissements du mobilier, matériel de bureau et aménagements'),
    ('2838', 'Amortissements des autres immobilisations corporelles'),
    ('34552', 'État - TVA récupérable sur charges'),
    ('4443', 'Caisses de retraite'),
    ('4452', 'État - TVA due'),
    ('4711', 'Compte d''attente'),
    ('6119', 'RRR obtenus sur achats'),
    ('6193', 'Dotations d''exploitation aux amortissements des immobilisations corporelles')
  )
  and not exists (
    select 1 from public.accounting_entry_lines l
    where l.account_id = a.id
  );
