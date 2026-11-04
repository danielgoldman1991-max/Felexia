-- Rollback 136. Drops the explicit payment link. Events themselves are kept.

do $$ begin
  if to_regclass('public.bank_reconciliation_events') is null then
    return;
  end if;
  alter table public.bank_reconciliation_events drop constraint if exists bank_reconciliation_events_payment_kind_check;
  alter table public.bank_reconciliation_events drop column if exists payment_kind;
  alter table public.bank_reconciliation_events drop column if exists created_payment_id;
  alter table public.bank_reconciliation_events drop column if exists created_transaction_id;
  alter table public.bank_reconciliation_events drop constraint if exists bank_reconciliation_events_action_check;
  alter table public.bank_reconciliation_events
    add constraint bank_reconciliation_events_action_check
    check (action in (
      'auto_confirmed', 'suggestion_confirmed', 'manual', 'undone', 'fee_booked', 'skipped'
    ));
end $$;
