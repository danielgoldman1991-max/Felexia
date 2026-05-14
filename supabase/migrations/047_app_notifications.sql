-- Migration 047: App notifications table for SaaS alerts (trial reminders, etc.)
create table if not exists app_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  action_label text,
  action_url text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'urgent', 'success', 'error')),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for fetching unread notifications per organization
create index if not exists app_notifications_org_unread_idx
  on app_notifications(organization_id, is_read, created_at desc);

-- Index for deduplication lookup
create index if not exists app_notifications_dedup_idx
  on app_notifications(organization_id, (metadata->>'kind'), (metadata->>'date'));

-- RLS
alter table app_notifications enable row level security;

drop policy if exists app_notifications_select on app_notifications;
create policy app_notifications_select on app_notifications
  for select to authenticated using (
    exists (select 1 from organization_members om where om.organization_id = app_notifications.organization_id and om.user_id = auth.uid() and om.status = 'active')
  );

drop policy if exists app_notifications_insert on app_notifications;
create policy app_notifications_insert on app_notifications
  for insert to authenticated with check (
    exists (select 1 from organization_members om where om.organization_id = app_notifications.organization_id and om.user_id = auth.uid() and om.status = 'active')
  );

drop policy if exists app_notifications_update on app_notifications;
create policy app_notifications_update on app_notifications
  for update to authenticated using (
    exists (select 1 from organization_members om where om.organization_id = app_notifications.organization_id and om.user_id = auth.uid() and om.status = 'active')
  );

-- Service role bypass for cron (bulk insert)
drop policy if exists app_notifications_insert_cron on app_notifications;
create policy app_notifications_insert_cron on app_notifications
  for insert to service_role with check (true);
