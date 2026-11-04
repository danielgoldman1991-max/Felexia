alter table public.accounting_settings drop column if exists auto_post_on_validation;

-- Les comptes ajoutés ne sont retirés que s'ils n'ont aucune ligne d'écriture.
delete from public.accounting_accounts a
where a.code in ('2831', '2833', '2834', '2835', '2838', '6119')
  and not exists (
    select 1 from public.accounting_entry_lines l
    where l.account_id = a.id
  );
