-- 115: demandes d'achat, consultations fournisseurs et retenue à la source.
-- Additive and idempotent. Existing payment rows keep withholding_amount 0.
-- Does not rewrite historical documents. Essentiel writes are refused by
-- assert_pro_write_access. Viewers stay read-only. Operators may write.
--
-- Rollback (run manually):
-- drop trigger if exists aa_pro_member_write on public.purchase_rfq_quotes;
-- drop trigger if exists aa_pro_member_write on public.purchase_rfqs;
-- drop trigger if exists aa_pro_member_write on public.purchase_request_lines;
-- drop trigger if exists aa_pro_member_write on public.purchase_requests;
-- drop table if exists public.purchase_rfq_quotes;
-- drop table if exists public.purchase_rfqs;
-- drop table if exists public.purchase_request_lines;
-- drop table if exists public.purchase_requests;
-- alter table public.supplier_payments drop column if exists net_amount;
-- alter table public.supplier_payments drop column if exists withholding_amount;
-- alter table public.supplier_payments drop column if exists withholding_kind;
-- drop function if exists app_private.guard_pro_member_write();

create or replace function app_private.guard_pro_member_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  org uuid := case when TG_OP = 'DELETE' then old.organization_id else new.organization_id end;
begin
  perform app_private.assert_pro_write_access(org, true);
  if auth.uid() is not null and app_private.is_read_only_org_member(org) then
    raise exception 'READ_ONLY' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.guard_pro_member_write() from public, anon, authenticated;

alter table public.supplier_payments
  add column if not exists withholding_kind text,
  add column if not exists withholding_amount numeric(14,2) not null default 0,
  add column if not exists net_amount numeric(14,2);

do $$ begin
  alter table public.supplier_payments
    add constraint supplier_payments_withholding_kind_check
    check (withholding_kind is null or withholding_kind in ('none', 'vat_attestation', 'fees_10', 'fees_30'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.supplier_payments
    add constraint supplier_payments_withholding_amount_check
    check (withholding_amount >= 0);
exception when duplicate_object then null;
end $$;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_number text not null,
  title text not null,
  needed_on date,
  status text not null default 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, request_number)
);

create table if not exists public.purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_name text,
  estimated_unit_price_ht numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_rfqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_number text not null,
  request_id uuid references public.purchase_requests(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  due_date date,
  awarded_quote_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, rfq_number)
);

create table if not exists public.purchase_rfq_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_id uuid not null references public.purchase_rfqs(id) on delete cascade,
  supplier_id uuid,
  supplier_name text not null,
  total_ht numeric(14,2) not null default 0,
  total_ttc numeric(14,2) not null default 0,
  lead_days integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.purchase_requests
    add constraint purchase_requests_status_check
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'ordered', 'cancelled'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.purchase_rfqs
    add constraint purchase_rfqs_status_check
    check (status in ('draft', 'sent', 'compared', 'awarded', 'cancelled'));
exception when duplicate_object then null;
end $$;

create index if not exists purchase_requests_org_idx on public.purchase_requests (organization_id, created_at desc);
create index if not exists purchase_request_lines_request_idx on public.purchase_request_lines (request_id);
create index if not exists purchase_rfqs_org_idx on public.purchase_rfqs (organization_id, created_at desc);
create index if not exists purchase_rfq_quotes_rfq_idx on public.purchase_rfq_quotes (rfq_id);

alter table public.purchase_requests enable row level security;
alter table public.purchase_request_lines enable row level security;
alter table public.purchase_rfqs enable row level security;
alter table public.purchase_rfq_quotes enable row level security;

drop policy if exists purchase_requests_select on public.purchase_requests;
create policy purchase_requests_select on public.purchase_requests
  for select to authenticated
  using (app_private.has_active_org_membership(organization_id));
drop policy if exists purchase_requests_write on public.purchase_requests;
create policy purchase_requests_write on public.purchase_requests
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

drop policy if exists purchase_request_lines_select on public.purchase_request_lines;
create policy purchase_request_lines_select on public.purchase_request_lines
  for select to authenticated
  using (app_private.has_active_org_membership(organization_id));
drop policy if exists purchase_request_lines_write on public.purchase_request_lines;
create policy purchase_request_lines_write on public.purchase_request_lines
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

drop policy if exists purchase_rfqs_select on public.purchase_rfqs;
create policy purchase_rfqs_select on public.purchase_rfqs
  for select to authenticated
  using (app_private.has_active_org_membership(organization_id));
drop policy if exists purchase_rfqs_write on public.purchase_rfqs;
create policy purchase_rfqs_write on public.purchase_rfqs
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

drop policy if exists purchase_rfq_quotes_select on public.purchase_rfq_quotes;
create policy purchase_rfq_quotes_select on public.purchase_rfq_quotes
  for select to authenticated
  using (app_private.has_active_org_membership(organization_id));
drop policy if exists purchase_rfq_quotes_write on public.purchase_rfq_quotes;
create policy purchase_rfq_quotes_write on public.purchase_rfq_quotes
  for all to authenticated
  using (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id))
  with check (app_private.has_active_org_membership(organization_id) and not app_private.is_read_only_org_member(organization_id));

grant select, insert, update, delete on public.purchase_requests, public.purchase_request_lines, public.purchase_rfqs, public.purchase_rfq_quotes to authenticated;
revoke all on public.purchase_requests, public.purchase_request_lines, public.purchase_rfqs, public.purchase_rfq_quotes from anon;

drop trigger if exists aa_pro_member_write on public.purchase_requests;
create trigger aa_pro_member_write before insert or update or delete on public.purchase_requests
  for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.purchase_request_lines;
create trigger aa_pro_member_write before insert or update or delete on public.purchase_request_lines
  for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.purchase_rfqs;
create trigger aa_pro_member_write before insert or update or delete on public.purchase_rfqs
  for each row execute function app_private.guard_pro_member_write();
drop trigger if exists aa_pro_member_write on public.purchase_rfq_quotes;
create trigger aa_pro_member_write before insert or update or delete on public.purchase_rfq_quotes
  for each row execute function app_private.guard_pro_member_write();
