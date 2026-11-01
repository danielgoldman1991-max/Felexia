-- Emergency complement to an application rollback. Keep the application in
-- maintenance/read-only mode: legacy code can write tables without these RPCs.
-- Requires launch-fixes-105-107.sql installed. No data or guard is deleted.
begin;
revoke all on function public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.convert_pro_quote_to_order_atomic(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.pro_transaction_capabilities(uuid) from public,anon,authenticated,service_role;
revoke all on function public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean) from public,anon,authenticated,service_role;
revoke all on function public.set_default_treasury_account_atomic(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.save_default_treasury_account_atomic(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
select not has_function_privilege('authenticated','public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamptz,jsonb,jsonb)','execute')
  and not has_function_privilege('authenticated','public.convert_pro_quote_to_order_atomic(uuid,uuid)','execute')
  and not has_function_privilege('authenticated','public.pro_transaction_capabilities(uuid)','execute')
  and not has_function_privilege('authenticated','public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean)','execute')
  and not has_function_privilege('authenticated','public.set_default_treasury_account_atomic(uuid,uuid)','execute')
  and not has_function_privilege('authenticated','public.save_default_treasury_account_atomic(uuid,uuid,jsonb)','execute') as launch_105_106_107_rpc_desactives;
