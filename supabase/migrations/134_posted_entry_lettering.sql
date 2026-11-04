-- 134: lettrage des écritures déjà comptabilisées.
-- Apply after 133. Additive. Amounts, accounts and status of posted entries stay immutable.
-- Only lettering_code and lettering_date may change on a posted line.
-- Rollback: supabase/rollbacks/134_posted_entry_lettering_rollback.sql

alter table public.accounting_entry_lines
  add column if not exists lettering_date date;

comment on column public.accounting_entry_lines.lettering_date is
  'Date du lettrage. Seuls le code et cette date peuvent être modifiés sur une ligne déjà comptabilisée.';

create or replace function app_private.guard_essential_posted_entry()
returns trigger language plpgsql security definer set search_path=public,app_private
as $$
declare parent_status text;
begin
  if tg_table_name='accounting_entries' then
    if old.status='posted' then
      if tg_op='DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['label','reference','notes','updated_at'])
        is distinct from (to_jsonb(old)-array['label','reference','notes','updated_at']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501';
      end if;
    end if;
  else
    select status into parent_status from public.accounting_entries where id=(to_jsonb(old)->>'entry_id')::uuid;
    if parent_status='posted' then
      if tg_op='DELETE' then raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501'; end if;
      if (to_jsonb(new)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status','lettering_code','lettering_date'])
        is distinct from (to_jsonb(old)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status','lettering_code','lettering_date']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501';
      end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;

revoke all on function app_private.guard_essential_posted_entry() from public, anon, authenticated;
