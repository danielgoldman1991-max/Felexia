-- 121: rattachement client des listes de prix et contenu des règles de relance.
-- Apply after 120. Additive. Existing lists and rules keep their rows.
--
-- Rollback:
-- alter table public.customer_price_lists drop column if exists customer_id;
-- alter table public.customer_price_lists drop column if exists active;
-- alter table public.customer_reminder_rules drop column if exists name;
-- alter table public.customer_reminder_rules drop column if exists channel;
-- alter table public.customer_reminder_rules drop column if exists subject;
-- alter table public.customer_reminder_rules drop column if exists message;

alter table public.customer_price_lists add column if not exists customer_id uuid;
alter table public.customer_price_lists add column if not exists active boolean not null default true;
alter table public.customer_reminder_rules add column if not exists name text;
alter table public.customer_reminder_rules add column if not exists channel text not null default 'email';
alter table public.customer_reminder_rules add column if not exists subject text;
alter table public.customer_reminder_rules add column if not exists message text;

do $$ begin
  alter table public.customer_price_lists
    add constraint customer_price_lists_customer_fk
    foreign key (customer_id) references public.third_parties(id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists customer_price_lists_customer_idx
  on public.customer_price_lists (organization_id, customer_id)
  where active;
