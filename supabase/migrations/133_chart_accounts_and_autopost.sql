-- 133: comptes CGNC manquants + option de comptabilisation automatique.
-- Additive. N'efface aucune écriture. Corrige uniquement le libellé 6193
-- lorsqu'il est encore le libellé de départ erroné « RRR obtenus sur achats ».
-- auto_post_on_validation est faux par défaut : rien n'est comptabilisé seul
-- tant que l'entreprise n'active pas l'option.
--
-- Rollback: supabase/rollbacks/133_chart_accounts_and_autopost_rollback.sql

alter table public.accounting_settings
  add column if not exists auto_post_on_validation boolean not null default false;

insert into public.accounting_accounts (
  organization_id, code, name, class_number, type,
  is_active, is_movement_allowed, is_auxiliary_required, is_auxiliary, is_system
)
select
  o.id, v.code, v.name, left(v.code, 1), v.type,
  true, true, false, false, true
from public.organizations o
cross join (values
  ('2831', 'Amortissements des terrains', 'asset'),
  ('2832', 'Amortissements des constructions', 'asset'),
  ('2833', 'Amortissements des installations techniques, matériel et outillage', 'asset'),
  ('2834', 'Amortissements du matériel de transport', 'asset'),
  ('2835', 'Amortissements du mobilier, matériel de bureau et aménagements', 'asset'),
  ('2838', 'Amortissements des autres immobilisations corporelles', 'asset'),
  ('34552', 'État - TVA récupérable sur charges', 'tax'),
  ('4443', 'Caisses de retraite', 'liability'),
  ('4452', 'État - TVA due', 'tax'),
  ('4711', 'Compte d''attente', 'liability'),
  ('6119', 'RRR obtenus sur achats', 'expense'),
  ('6193', 'Dotations d''exploitation aux amortissements des immobilisations corporelles', 'expense')
) as v(code, name, type)
where not exists (
  select 1 from public.accounting_accounts a
  where a.organization_id = o.id and a.code = v.code and a.archived_at is null
);

update public.accounting_accounts
set name = 'Dotations d''exploitation aux amortissements des immobilisations corporelles'
where code = '6193'
  and name in ('RRR obtenus sur achats', 'RRR obtenus sur achats ');
