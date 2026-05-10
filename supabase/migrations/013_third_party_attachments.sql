create table if not exists public.third_party_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  third_party_id uuid not null references public.third_parties(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  mime_type text,
  file_size bigint,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz null
);

create index if not exists third_party_attachments_organization_id_idx
  on public.third_party_attachments (organization_id);

create index if not exists third_party_attachments_third_party_id_idx
  on public.third_party_attachments (third_party_id);

create index if not exists third_party_attachments_uploaded_by_idx
  on public.third_party_attachments (uploaded_by);

create index if not exists third_party_attachments_created_at_idx
  on public.third_party_attachments (created_at);

alter table public.third_party_attachments enable row level security;

drop policy if exists third_party_attachments_org_member_all on public.third_party_attachments;
create policy third_party_attachments_org_member_all
on public.third_party_attachments
for all
using (app_private.is_org_member(organization_id))
with check (app_private.is_org_member(organization_id));

drop policy if exists profiles_org_members_read on public.profiles;
create policy profiles_org_members_read
on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members current_member
    join public.organization_members target_member
      on target_member.organization_id = current_member.organization_id
    where current_member.user_id = auth.uid()
      and current_member.status = 'active'
      and target_member.user_id = profiles.id
      and target_member.status = 'active'
  )
);
