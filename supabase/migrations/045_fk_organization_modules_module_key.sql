-- Migration 045: Add FK constraint on organization_modules.module_key
-- Ensures only valid module_key values from modules_catalog can be inserted.
-- The NOT VALID option skips checking existing rows (they should be valid already).

alter table organization_modules
  drop constraint if exists organization_modules_module_key_fkey;

alter table organization_modules
  add constraint organization_modules_module_key_fkey
  foreign key (module_key) references modules_catalog(module_key)
  on delete cascade;
