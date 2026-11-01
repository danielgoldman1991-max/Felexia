-- Emergency rollback of migration104 only. MANUAL, NOT EXECUTED.
-- Restore the previous application version before using this script: the
-- previous database behavior does not enforce the public PRO write boundary.
-- No business data, subscription, price, document, number or SELECT policy changes.
begin;

do $$ declare target record; begin
  for target in
    select n.nspname,c.relname from pg_trigger t
    join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname='public' and t.tgname='aa_pro_erp_write_guard'
      and t.tgfoid=to_regprocedure('app_private.guard_pro_erp_write()')
  loop
    execute format('drop trigger aa_pro_erp_write_guard on %I.%I',target.nspname,target.relname);
  end loop;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists pro_storage_insert_guard_104 on storage.objects';
    execute 'drop policy if exists pro_storage_update_guard_104 on storage.objects';
    execute 'drop policy if exists pro_storage_delete_guard_104 on storage.objects';
  end if;
end $$;

drop function if exists public.erp_get_capabilities(uuid);
drop function if exists app_private.can_write_pro_storage(text,text);
drop function if exists app_private.guard_pro_erp_write();
drop function if exists app_private.assert_pro_write_access(uuid,boolean);
notify pgrst,'reload schema';
commit;
