delete from public.accounting_entry_lines
where entry_id in (
  select id
  from public.accounting_entries
  where status = 'cancelled'
);

do $$
begin
  if to_regclass('public.accounting_document_links') is not null then
    delete from public.accounting_document_links
    where accounting_entry_id in (
      select id
      from public.accounting_entries
      where status = 'cancelled'
    );
  end if;
end $$;

delete from public.accounting_entries
where status = 'cancelled';
