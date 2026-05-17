alter table public.accounting_accounts
  add column if not exists is_auxiliary boolean not null default false;

alter table public.accounting_accounts
  add column if not exists archived_at timestamptz null;

alter table public.accounting_journals
  add column if not exists archived_at timestamptz null;

insert into public.accounting_accounts (
  organization_id,
  code,
  name,
  class_number,
  type,
  is_active,
  is_movement_allowed,
  is_auxiliary_required,
  is_auxiliary,
  is_system
)
select
  o.id,
  v.code,
  v.name,
  left(v.code, 1),
  v.type,
  true,
  true,
  false,
  false,
  true
from public.organizations o
cross join (values
  ('1111', 'Capital social', 'equity'),
  ('1191', 'Resultat net de l''exercice', 'equity'),
  ('2111', 'Frais preliminaires', 'asset'),
  ('2332', 'Materiel de transport', 'asset'),
  ('2355', 'Materiel informatique', 'asset'),
  ('3111', 'Marchandises', 'asset'),
  ('3421', 'Clients', 'third_party'),
  ('3455', 'Etat - TVA recuperable', 'tax'),
  ('3488', 'Divers debiteurs', 'asset'),
  ('4411', 'Fournisseurs', 'third_party'),
  ('4455', 'Etat - TVA facturee', 'tax'),
  ('4488', 'Divers crediteurs', 'liability'),
  ('4501', 'Etat - Impots et taxes', 'liability'),
  ('5141', 'Banques', 'treasury'),
  ('5161', 'Caisses', 'treasury'),
  ('5520', 'Credit de tresorerie', 'liability'),
  ('6111', 'Achats de marchandises', 'expense'),
  ('6122', 'Achats consommes / services', 'expense'),
  ('6147', 'Services bancaires', 'expense'),
  ('6156', 'Honoraires', 'expense'),
  ('6161', 'Impots et taxes', 'expense'),
  ('6171', 'Charges de personnel', 'expense'),
  ('6311', 'Interets des emprunts', 'expense'),
  ('6588', 'Autres charges diverses', 'expense'),
  ('7111', 'Ventes de marchandises', 'revenue'),
  ('7121', 'Ventes de biens et services produits', 'revenue'),
  ('7124', 'Prestations de services', 'revenue'),
  ('7381', 'Interets et produits assimiles', 'revenue'),
  ('7588', 'Autres produits divers', 'revenue')
) as v(code, name, type)
where not exists (
  select 1
  from public.accounting_accounts a
  where a.organization_id = o.id
    and a.code = v.code
    and a.archived_at is null
);

insert into public.accounting_journals (
  organization_id,
  code,
  name,
  type,
  description,
  is_active
)
select
  o.id,
  v.code,
  v.name,
  v.type,
  v.description,
  true
from public.organizations o
cross join (values
  ('VE', 'Journal des ventes', 'sales', 'Ecritures de ventes et facturation client'),
  ('AC', 'Journal des achats', 'purchases', 'Ecritures d''achats et facturation fournisseur'),
  ('BQ', 'Journal banque', 'bank', 'Operations bancaires'),
  ('CA', 'Journal caisse', 'cash', 'Operations de caisse'),
  ('OD', 'Operations diverses', 'od', 'Ecritures diverses et corrections')
) as v(code, name, type, description)
where not exists (
  select 1
  from public.accounting_journals j
  where j.organization_id = o.id
    and j.code = v.code
    and j.archived_at is null
);

insert into public.accounting_settings (
  organization_id,
  sales_journal_code,
  purchases_journal_code,
  bank_journal_code,
  cash_journal_code,
  od_journal_code
)
select
  o.id,
  'VE',
  'AC',
  'BQ',
  'CA',
  'OD'
from public.organizations o
where not exists (
  select 1
  from public.accounting_settings s
  where s.organization_id = o.id
);

do $$
begin
  if not exists (
    select 1
    from public.accounting_accounts
    where archived_at is null
    group by organization_id, code
    having count(*) > 1
  ) then
    create unique index if not exists accounting_accounts_org_code_active_unique
      on public.accounting_accounts (organization_id, code)
      where archived_at is null;
  end if;

  if not exists (
    select 1
    from public.accounting_journals
    where archived_at is null
    group by organization_id, code
    having count(*) > 1
  ) then
    create unique index if not exists accounting_journals_org_code_active_unique
      on public.accounting_journals (organization_id, code)
      where archived_at is null;
  end if;
end $$;
