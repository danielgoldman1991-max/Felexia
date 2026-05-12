-- 034_accounting_auto_entries.sql
-- Adds missing PCG accounts (service-specific), product accounting columns,
-- and ensures accounting_entries has proper indexes for source lookups.
-- Idempotent.

-- Seed missing chart-of-accounts entries (if not already present)
insert into public.accounting_accounts (organization_id, code, name, class_number, type, parent_code, is_movement_allowed, is_auxiliary_required, is_system)
select o.id, v.code, v.name, left(v.code, 1), v.type, v.parent_code, true, v.aux_required, true
from public.organizations o
cross join (values
  ('6122','Achats consommes de matieres et fournitures','expense',null,false),
  ('7124','Prestations de services','revenue',null,false)
) as v(code, name, type, parent_code, aux_required)
where not exists (
  select 1 from public.accounting_accounts aa
  where aa.organization_id = o.id and aa.code = v.code
);

-- Add product accounting columns (idempotent)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'sales_account_id') then
    alter table public.products add column sales_account_id uuid null references public.accounting_accounts(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'purchase_account_id') then
    alter table public.products add column purchase_account_id uuid null references public.accounting_accounts(id);
  end if;
end $$;

-- Ensure accounting_entries has source lookup index (idempotent)
create index if not exists accounting_entries_source_lookup_idx on public.accounting_entries (organization_id, source_module, source_document_type, source_document_id);
