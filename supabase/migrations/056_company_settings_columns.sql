alter table company_settings add column if not exists phone text;
alter table company_settings add column if not exists email text;
alter table company_settings add column if not exists website text;
alter table company_settings add column if not exists activity text;
alter table company_settings add column if not exists footer_text text;
alter table company_settings add column if not exists logo_url text;
alter table company_settings add column if not exists patente text;
alter table company_settings add column if not exists tax_identifier text;

alter table organizations add column if not exists phone text;
alter table organizations add column if not exists email text;
alter table organizations add column if not exists city text;
alter table organizations add column if not exists address text;
alter table organizations add column if not exists logo_url text;
alter table organizations add column if not exists ice text;
alter table organizations add column if not exists activity text;
alter table organizations add column if not exists currency text default 'MAD';

notify pgrst, 'reload schema';

