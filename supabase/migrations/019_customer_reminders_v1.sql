create table if not exists public.customer_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reminder_number text not null,
  customer_id uuid not null references public.third_parties(id),
  reminder_level integer not null default 1,
  status text not null default 'draft',
  channel text null,
  reminder_date date not null default current_date,
  due_date date null,
  sent_at timestamptz null,
  cancelled_at timestamptz null,
  total_due_amount numeric(14,2) not null default 0,
  total_overdue_amount numeric(14,2) not null default 0,
  subject text null,
  message text null,
  internal_notes text null,
  created_by uuid null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz null,
  constraint customer_reminders_level_check check (reminder_level >= 1),
  constraint customer_reminders_status_check check (status in ('draft', 'sent', 'cancelled')),
  constraint customer_reminders_channel_check check (channel is null or channel in ('email', 'phone', 'whatsapp', 'letter', 'in_person', 'other')),
  constraint customer_reminders_number_org_unique unique (organization_id, reminder_number)
);

create table if not exists public.customer_reminder_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reminder_id uuid not null references public.customer_reminders(id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices(id),
  invoice_number text null,
  invoice_date date null,
  due_date date null,
  total_ttc numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  days_overdue integer null,
  created_at timestamptz default now()
);

create index if not exists customer_reminders_organization_id_idx on public.customer_reminders (organization_id);
create index if not exists customer_reminders_customer_id_idx on public.customer_reminders (customer_id);
create index if not exists customer_reminders_reminder_number_idx on public.customer_reminders (reminder_number);
create index if not exists customer_reminders_status_idx on public.customer_reminders (status);
create index if not exists customer_reminders_reminder_date_idx on public.customer_reminders (reminder_date);
create index if not exists customer_reminders_reminder_level_idx on public.customer_reminders (reminder_level);
create index if not exists customer_reminders_archived_at_idx on public.customer_reminders (archived_at);

create index if not exists customer_reminder_invoices_organization_id_idx on public.customer_reminder_invoices (organization_id);
create index if not exists customer_reminder_invoices_reminder_id_idx on public.customer_reminder_invoices (reminder_id);
create index if not exists customer_reminder_invoices_invoice_id_idx on public.customer_reminder_invoices (invoice_id);

alter table public.customer_reminders enable row level security;
alter table public.customer_reminder_invoices enable row level security;

drop policy if exists customer_reminders_org_member_all on public.customer_reminders;
create policy customer_reminders_org_member_all
on public.customer_reminders
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists customer_reminder_invoices_org_member_all on public.customer_reminder_invoices;
create policy customer_reminder_invoices_org_member_all
on public.customer_reminder_invoices
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

create or replace function public.generate_customer_reminder_number()
returns trigger language plpgsql as $$
declare
  yy text := to_char(coalesce(new.reminder_date, current_date), 'YY');
  mm text := to_char(coalesce(new.reminder_date, current_date), 'MM');
  seq_prefix text := 'REL-' || yy || mm || '-';
  seq_next integer;
begin
  if new.reminder_number is not null and new.reminder_number <> '' then
    return new;
  end if;

  select coalesce(max((right(reminder_number, 5))::integer), 0) + 1
    into seq_next
  from public.customer_reminders
  where organization_id = new.organization_id
    and reminder_number like seq_prefix || '%';

  new.reminder_number := seq_prefix || lpad(seq_next::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists customer_reminders_number on public.customer_reminders;
create trigger customer_reminders_number
before insert on public.customer_reminders
for each row execute function public.generate_customer_reminder_number();

drop trigger if exists customer_reminders_set_updated_at on public.customer_reminders;
create trigger customer_reminders_set_updated_at
before update on public.customer_reminders
for each row execute function public.set_updated_at();
