-- Read-only checks before applying 112. Do not insert, update or delete.
-- Run in the Supabase SQL editor with a role that can read pg_policies and pg_proc.

select 'billing_update_locked' as check_name,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_subscriptions'
      and policyname = 'essential_billing_update_server_only'
      and permissive = 'RESTRICTIVE'
  ) as ok;

select 'pro_write_guard' as check_name,
  to_regprocedure('app_private.assert_pro_write_access(uuid,boolean)') is not null as ok;

select 'pro_read_guard' as check_name,
  to_regprocedure('app_private.can_read_pro_erp_110(uuid)') is not null
  or to_regprocedure('public.can_read_pro_erp_110(uuid)') is not null as ok;

select 'quota_function' as check_name,
  to_regprocedure('app_private.guard_commercial_document_quota()') is not null as ok;

select plan_code, count(*) as subscriptions
from public.organization_subscriptions
group by plan_code
order by plan_code;
