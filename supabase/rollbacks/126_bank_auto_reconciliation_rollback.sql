-- Rollback of 126. Drops only the automatic reconciliation tables.
-- Existing statement lines, imports and bank_reconciliations are kept.

drop trigger if exists aa_pro_member_write on public.bank_reconciliation_group_items;
drop trigger if exists aa_pro_member_write on public.bank_reconciliation_groups;
drop trigger if exists aa_pro_member_write on public.bank_reconciliation_events;
drop trigger if exists aa_pro_member_write on public.bank_reconciliation_settings;
drop trigger if exists aa_pro_member_write on public.bank_match_learnings;
drop trigger if exists aa_pro_member_write on public.bank_match_rules;
drop trigger if exists aa_pro_member_write on public.bank_import_mappings;

drop table if exists public.bank_reconciliation_group_items;
drop table if exists public.bank_reconciliation_groups;
drop table if exists public.bank_reconciliation_events;
drop table if exists public.bank_reconciliation_settings;
drop table if exists public.bank_match_learnings;
drop table if exists public.bank_match_rules;
drop table if exists public.bank_import_mappings;
