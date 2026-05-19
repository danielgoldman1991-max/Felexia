alter table if exists public.organizations
  add column if not exists onboarding_step text not null default 'company',
  add column if not exists onboarding_completed boolean not null default false;

delete from public.organization_subscriptions
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by organization_id
        order by created_at desc, updated_at desc nulls last
      ) as rn
    from public.organization_subscriptions
  ) ranked
  where ranked.rn > 1
);

create unique index if not exists organization_subscriptions_organization_id_unique
  on public.organization_subscriptions (organization_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_onboarding_step_check'
  ) then
    alter table public.organizations
      add constraint organizations_onboarding_step_check
      check (onboarding_step in ('company', 'subscription_choice', 'getting_started', 'completed'));
  end if;
end $$;

update public.organizations o
set onboarding_step = case
  when o.onboarding_completed = true then 'completed'
  when exists (
    select 1
    from public.organization_subscriptions os
    where os.organization_id = o.id
      and os.status in ('trialing', 'active')
  ) then 'getting_started'
  else coalesce(nullif(o.onboarding_step, 'company'), 'subscription_choice')
end;

update public.organizations o
set onboarding_step = 'getting_started',
    onboarding_completed = false
where o.onboarding_step = 'subscription_choice'
  and exists (
    select 1
    from public.organization_subscriptions s
    where s.organization_id = o.id
      and s.status in ('trialing', 'active')
  );

update public.organizations
set onboarding_step = 'completed'
where onboarding_completed = true
  and onboarding_step <> 'completed';
