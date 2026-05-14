-- Migration 043: Make plan_id nullable for module-based subscriptions
alter table organization_subscriptions alter column plan_id drop not null;

-- Add unique constraint on organization_id for upsert support.
-- Remove duplicates first (keep only the latest row per organization).
delete from organization_subscriptions
where id in (
  select id from (
    select id, row_number() over (partition by organization_id order by created_at desc) as rn
    from organization_subscriptions
  ) t where t.rn > 1
);

alter table organization_subscriptions drop constraint if exists organization_subscriptions_organization_id_key;
alter table organization_subscriptions add constraint organization_subscriptions_organization_id_key unique (organization_id);
