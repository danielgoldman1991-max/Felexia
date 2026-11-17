-- 154: an invoice past its due date with a remaining balance stays "overdue"
-- when a credit note recalculates it, including a partial credit. Paid amount
-- is left untouched. Only this function is replaced. Accounting guards are
-- not rewritten. No anon grant. Not applied here.
-- Rollback: supabase/rollbacks/154_credit_note_overdue_status_rollback.sql

create or replace function app_private.refresh_credit_note_balances(p_organization_id uuid,p_credit_note_id uuid)
returns void language plpgsql security invoker set search_path=public,app_private
as $$
begin
  if auth.uid() is null or not app_private.has_active_org_membership(p_organization_id) or app_private.is_read_only_org_member(p_organization_id) then raise exception 'CREDIT_WRITE_REQUIRED' using errcode='42501'; end if;
  update public.customer_credit_notes n set applied_amount=x.amount,available_amount=greatest(n.total_ttc-x.amount,0),status=case when x.amount=0 then 'validated' when x.amount<n.total_ttc then 'partially_applied' else 'applied' end
  from (select coalesce(sum(amount),0) amount from public.customer_credit_note_applications where organization_id=p_organization_id and credit_note_id=p_credit_note_id and cancelled_at is null) x
  where n.id=p_credit_note_id and n.organization_id=p_organization_id and n.status not in ('draft','cancelled');
  update public.customer_invoices i set credit_amount=x.amount,remaining_amount=greatest(i.total_ttc-i.paid_amount-x.amount,0),payment_status=case when i.total_ttc-i.paid_amount-x.amount<=0 then 'paid' when i.paid_amount+x.amount>0 then 'partial' else 'unpaid' end,
    status=case
      when i.total_ttc-i.paid_amount-x.amount<=0 then 'paid'
      when greatest(i.total_ttc-i.paid_amount-x.amount,0)>0
        and i.due_date is not null
        and i.due_date < (clock_timestamp() at time zone 'Africa/Casablanca')::date then 'overdue'
      when i.paid_amount+x.amount>0 then 'partially_paid'
      when i.status in ('paid','partially_paid') then case when i.sent_at is not null then 'sent' else 'validated' end
      else i.status
    end
  from (select invoice.id,coalesce(sum(a.amount) filter(where a.cancelled_at is null),0) amount from public.customer_invoices invoice left join public.customer_credit_note_applications a on a.invoice_id=invoice.id and a.organization_id=p_organization_id where invoice.organization_id=p_organization_id and invoice.id in(select invoice_id from public.customer_credit_note_applications where organization_id=p_organization_id and credit_note_id=p_credit_note_id) group by invoice.id) x
  where i.id=x.id and i.organization_id=p_organization_id and i.status not in ('draft','cancelled');
end $$;
revoke all on function app_private.refresh_credit_note_balances(uuid,uuid) from public,anon;
grant execute on function app_private.refresh_credit_note_balances(uuid,uuid) to authenticated;
