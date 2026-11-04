-- 132: ordre du fichier d'import pour le solde de clôture du relevé.
-- Additive et nullable. Les imports déjà en base restent NULL ;
-- l'application reconstitue alors le solde de clôture par le chaînage des soldes.
--
-- Rollback: supabase/rollbacks/132_statement_line_file_order_rollback.sql

alter table public.bank_statement_lines
  add column if not exists file_order integer null;
