-- 136: explicit link from a reconciliation event to the payment or movement it created.
-- Apply after 135. Additive. Existing events keep an empty link.
-- Undo must use created_payment_id / created_transaction_id, not a created_at window.
-- Rollback: supabase/rollbacks/136_reconciliation_created_payment_rollback.sql

do $$ begin
  if to_regclass('public.bank_reconciliation_events') is null then
    return;
  end if;
  alter table public.bank_reconciliation_events
    add column if not exists created_payment_id uuid,
    add column if not exists created_transaction_id uuid,
    add column if not exists payment_kind text;
  if not exists (
    select 1 from pg_constraint
    where conname = 'bank_reconciliation_events_payment_kind_check'
      and conrelid = 'public.bank_reconciliation_events'::regclass
  ) then
    alter table public.bank_reconciliation_events
      add constraint bank_reconciliation_events_payment_kind_check
      check (payment_kind is null or payment_kind in ('customer', 'supplier'));
  end if;
  alter table public.bank_reconciliation_events drop constraint if exists bank_reconciliation_events_action_check;
  alter table public.bank_reconciliation_events
    add constraint bank_reconciliation_events_action_check
    check (action in (
      'auto_confirmed', 'suggestion_confirmed', 'manual', 'undone', 'fee_booked', 'skipped',
      'movement_created', 'manual_grouped'
    ));
end $$;

comment on column public.bank_reconciliation_events.created_payment_id is
  'Règlement créé par ce rapprochement. L''annulation s''appuie sur cet identifiant.';
