-- Rollback of 153. Restores the function bodies from 152 and from
-- 20260810213138. Does not grant anything to anon.

create or replace function app_private.refresh_restored_invoice_status(
  p_organization_id uuid,
  p_table text,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $status$
declare
  today date := (clock_timestamp() at time zone 'Africa/Casablanca')::date;
begin
  if p_table = 'customer_invoices' then
    update public.customer_invoices invoice
    set payment_status = case
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) <= 0 then 'unpaid'
          when greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          else 'partial'
        end,
        status = case
          when invoice.status in ('draft', 'cancelled') then invoice.status
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0
            and greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0 then 'partially_paid'
          when invoice.due_date is not null and invoice.due_date < today then 'overdue'
          when invoice.status = 'sent' then 'sent'
          else 'validated'
        end
    where invoice.organization_id = p_organization_id
      and invoice.id in (
        select (elem->>'id')::uuid from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) elem where elem->>'id' is not null
      );
  elsif p_table = 'supplier_invoices' then
    update public.supplier_invoices invoice
    set payment_status = case
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) <= 0 then 'unpaid'
          when greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          else 'partial'
        end,
        status = case
          when invoice.status in ('draft', 'cancelled') then invoice.status
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0
            and greatest(coalesce(invoice.total_ttc, 0) - coalesce(invoice.paid_amount, 0) - coalesce(invoice.credit_amount, 0), 0) <= 0 then 'paid'
          when coalesce(invoice.paid_amount, 0) + coalesce(invoice.credit_amount, 0) > 0 then 'partially_paid'
          else 'validated'
        end
    where invoice.organization_id = p_organization_id
      and invoice.id in (
        select (elem->>'id')::uuid from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) elem where elem->>'id' is not null
      );
  end if;
end;
$status$;
revoke all on function app_private.refresh_restored_invoice_status(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.sync_customer_invoice_payment_totals(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total numeric(14,2);
  v_credit numeric(14,2);
  v_current_status text;
  v_paid numeric(14,2);
  v_remaining numeric(14,2);
  v_payment_status text;
begin
  select total_ttc, coalesce(credit_amount, 0), status
    into v_total, v_credit, v_current_status
  from public.customer_invoices
  where id = p_invoice_id
  for update;
  if not found then return; end if;

  select coalesce(sum(allocation.amount), 0)::numeric(14,2) into v_paid
  from public.customer_payment_allocations allocation
  join public.customer_payments payment on payment.id = allocation.payment_id
  where allocation.invoice_id = p_invoice_id
    and allocation.cancelled_at is null
    and payment.archived_at is null
    and payment.status in ('confirmed', 'partially_allocated', 'allocated');

  v_remaining := greatest(v_total - v_paid - v_credit, 0);
  v_payment_status := case
    when v_paid + v_credit <= 0 then 'unpaid'
    when v_remaining <= 0 then 'paid'
    else 'partial'
  end;

  update public.customer_invoices
  set paid_amount = least(v_paid, greatest(v_total - v_credit, 0)),
      remaining_amount = v_remaining,
      payment_status = v_payment_status,
      status = case
        when v_current_status in ('draft', 'cancelled') then v_current_status
        when v_payment_status = 'paid' then 'paid'
        when v_payment_status = 'partial' then 'partially_paid'
        when v_current_status in ('sent', 'overdue') then v_current_status
        else 'validated'
      end,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;
revoke all on function public.sync_customer_invoice_payment_totals(uuid) from public, anon;
grant execute on function public.sync_customer_invoice_payment_totals(uuid) to authenticated;

create or replace function app_private.guard_cash_non_negative()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $cash$
declare
  account_kind text;
  current_balance numeric;
  previous_delta numeric := 0;
  next_delta numeric := 0;
  projected numeric;
begin
  if app_private.organization_restore_active(new.organization_id) then
    return new;
  end if;
  select account.account_type, account.current_balance into account_kind, current_balance
  from public.treasury_accounts account
  where account.id = new.treasury_account_id;
  if account_kind is distinct from 'cash' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is null and old.treasury_account_id = new.treasury_account_id then
    previous_delta := case
      when old.transaction_type = 'opening_balance' then 0
      when old.direction = 'out' then -old.amount
      else old.amount
    end;
  end if;
  if new.archived_at is null then
    next_delta := case
      when new.transaction_type = 'opening_balance' then 0
      when new.direction = 'out' then -new.amount
      else new.amount
    end;
  end if;
  if next_delta < previous_delta then
    projected := coalesce(current_balance, 0) - previous_delta + next_delta;
    if projected < 0 or coalesce(current_balance, 0) < 0 then
      raise exception 'CASH_NEGATIVE_BALANCE' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$cash$;
revoke all on function app_private.guard_cash_non_negative() from public, anon, authenticated;
