-- Rollback of 127. Drops only the collection tables added for reminders.
-- Existing customer_reminders and customer_reminder_rules are kept.

drop trigger if exists aa_pro_member_write on public.customer_reminder_dispatches;
drop trigger if exists aa_pro_member_write on public.customer_payment_promises;
drop trigger if exists aa_pro_member_write on public.customer_collection_exclusions;
drop trigger if exists aa_pro_member_write on public.customer_collection_settings;

drop table if exists public.customer_reminder_dispatches;
drop table if exists public.customer_payment_promises;
drop table if exists public.customer_collection_exclusions;
drop table if exists public.customer_collection_settings;
