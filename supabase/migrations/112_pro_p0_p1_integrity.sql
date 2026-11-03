-- P0/P1 integrity: PRO alias quota, stock transfers, lettering column, SME chart additions.
-- Additive. Does not rewrite existing accounts, subscriptions, documents or balances.
-- Apply manually after 111. Do not run against production until the backup is confirmed.

begin;

create or replace function app_private.guard_commercial_document_quota()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare plan text; max_docs integer; used bigint; month_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('commercial-quota|'||new.organization_id::text,0));
  if exists(select 1 from commercial_document_usage where organization_id=new.organization_id and document_table=TG_TABLE_NAME and document_id=new.id) then return new; end if;
  if auth.uid() is not null then
    perform app_private.assert_essential_write_access(new.organization_id);
    select plan_code into plan from organization_subscriptions where organization_id=new.organization_id order by created_at desc limit 1;
    max_docs := case
      when plan in ('premium', 'pro') then null
      when plan = 'business' then 3000
      else 500
    end;
    month_start := date_trunc('month',clock_timestamp() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca';
    select count(*) into used from commercial_document_usage where organization_id=new.organization_id and created_at>=month_start
      and created_at<((date_trunc('month',clock_timestamp() at time zone 'Africa/Casablanca')+interval '1 month') at time zone 'Africa/Casablanca');
    if max_docs is not null and used>=max_docs then
      raise exception 'COMMERCIAL_DOCUMENT_LIMIT_REACHED' using errcode='23514';
    end if;
  elsif coalesce(current_setting('role',true),'none') in ('anon','authenticated') then
    raise exception 'SUBSCRIPTION_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;
  insert into commercial_document_usage(organization_id,document_table,document_id)
  values(new.organization_id,TG_TABLE_NAME,new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function app_private.guard_commercial_document_quota() from public,anon,authenticated;

do $$
declare constraint_record record;
begin
  if to_regclass('public.stock_moves') is null then return; end if;
  for constraint_record in
    select conname from pg_constraint
    where conrelid = 'public.stock_moves'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%move_type%'
  loop
    execute format('alter table public.stock_moves drop constraint if exists %I', constraint_record.conname);
  end loop;
  alter table public.stock_moves
    add constraint stock_moves_move_type_check
    check (move_type in (
      'delivery_out', 'customer_return_in', 'adjustment_in', 'adjustment_out',
      'manual_stock_in', 'manual_stock_out', 'initial_stock', 'purchase_in',
      'purchase_receipt_in', 'transfer_out', 'transfer_in'
    ));
end $$;

create or replace function public.transfer_stock_between_locations(
  p_organization_id uuid,
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
  p_notes text default null
) returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare available numeric; operation_key uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'SUBSCRIPTION_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  perform app_private.assert_pro_write_access(p_organization_id, true);
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Emplacements identiques.' using errcode = '23514';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'Quantite invalide.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.warehouses
    where organization_id = p_organization_id and id in (p_from_warehouse_id, p_to_warehouse_id)
    having count(*) = 2
  ) then
    raise exception 'Emplacement introuvable pour cette entreprise.' using errcode = '23514';
  end if;
  select quantity into available from public.stock_levels
  where organization_id = p_organization_id and warehouse_id = p_from_warehouse_id and product_id = p_product_id;
  if coalesce(available, 0) < p_quantity then
    raise exception 'Stock insuffisant sur l''emplacement de depart.' using errcode = '23514';
  end if;
  insert into public.stock_moves (
    organization_id, warehouse_id, product_id, move_type, direction, quantity,
    movement_date, notes, created_by, stock_operation_key, stock_operation_index
  ) values
    (p_organization_id, p_from_warehouse_id, p_product_id, 'transfer_out', 'out', p_quantity, now(), nullif(btrim(p_notes), ''), auth.uid(), operation_key, 1),
    (p_organization_id, p_to_warehouse_id, p_product_id, 'transfer_in', 'in', p_quantity, now(), nullif(btrim(p_notes), ''), auth.uid(), operation_key, 2);
end $$;
revoke all on function public.transfer_stock_between_locations(uuid, uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.transfer_stock_between_locations(uuid, uuid, uuid, uuid, numeric, text) to authenticated;

do $$
begin
  if to_regclass('public.accounting_entry_lines') is not null then
    alter table public.accounting_entry_lines add column if not exists lettering_code text;
  end if;
end $$;

insert into public.accounting_accounts (
  organization_id, code, name, class_number, type, is_active, is_movement_allowed, is_auxiliary_required, is_auxiliary, is_system
)
select organization.id, account.code, account.name, left(account.code, 1), account.type, true, true, false, false, true
from public.organizations organization
cross join (values
  ('1161', 'Report à nouveau', 'equity'),
  ('2230', 'Constructions', 'asset'),
  ('2340', 'Matériel et outillage', 'asset'),
  ('2351', 'Mobilier de bureau', 'asset'),
  ('2411', 'Logiciels', 'asset'),
  ('2832', 'Amortissements du matériel de transport', 'asset'),
  ('3121', 'Matières premières', 'asset'),
  ('3131', 'Fournitures consommables', 'asset'),
  ('3424', 'Clients douteux ou litigieux', 'third_party'),
  ('3458', 'État - autres taxes récupérables', 'tax'),
  ('3491', 'Charges constatées d''avance', 'asset'),
  ('4417', 'Fournisseurs d''immobilisations', 'third_party'),
  ('4432', 'Rémunérations dues au personnel', 'liability'),
  ('4441', 'CNSS', 'liability'),
  ('4448', 'Autres organismes sociaux', 'liability'),
  ('4456', 'État - TVA due', 'tax'),
  ('4457', 'État - crédit de TVA', 'tax'),
  ('4491', 'Produits constatés d''avance', 'liability'),
  ('5115', 'Chèques à encaisser', 'treasury'),
  ('6131', 'Locations et charges locatives', 'expense'),
  ('6142', 'Transports', 'expense'),
  ('6174', 'Charges sociales', 'expense'),
  ('6193', 'RRR obtenus sur achats', 'expense'),
  ('6386', 'Escomptes accordés', 'expense'),
  ('7181', 'RRR accordés sur ventes', 'revenue'),
  ('7386', 'Escomptes obtenus', 'revenue')
) as account(code, name, type)
where not exists (
  select 1 from public.accounting_accounts existing
  where existing.organization_id = organization.id and existing.code = account.code
);

commit;
