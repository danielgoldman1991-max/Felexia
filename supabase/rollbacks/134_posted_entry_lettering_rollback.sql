-- Rollback 134. Restores the posted-entry guard from migration 098 and drops lettering_date.
-- Existing lettering_code values are kept (column introduced by 112).

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
      if (to_jsonb(new)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status'])
        is distinct from (to_jsonb(old)-array['account_id','account_code','account_label','auxiliary_id','label','notes','updated_at','reconciliation_status']) then
        raise exception 'FINANCE_POSTED_ENTRY_READ_ONLY' using errcode='42501';
      end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;

alter table public.accounting_entry_lines drop column if exists lettering_date;
