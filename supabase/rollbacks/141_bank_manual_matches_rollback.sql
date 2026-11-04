-- Rollback of 141. Drops only the manual-match tables and functions created by that migration.
-- Statement lines, treasury movements and older reconciliation events are left in place.
-- A line closed by a manual match stays reconciled until it is reopened in the application.

drop function if exists public.undo_bank_manual_match(uuid, uuid);
drop function if exists public.save_bank_manual_match(uuid, uuid, jsonb, jsonb);
drop table if exists public.bank_manual_match_documents;
drop table if exists public.bank_manual_match_lines;
drop table if exists public.bank_manual_matches;
