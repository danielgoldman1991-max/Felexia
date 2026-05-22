alter table public.organizations
  add column if not exists forme_juridique text null;

alter table public.organizations
  add column if not exists ville_rc text null;

alter table public.company_settings
  add column if not exists forme_juridique text null;

alter table public.company_settings
  add column if not exists ville_rc text null;

notify pgrst, 'reload schema';
