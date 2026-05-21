-- Migration: fix RLS policies for vat_declarations
-- Problem: policies used custom EXISTS checks without GRANTs;
-- Solution: align with project standard using app_private.is_org_member

-- Drop old policies
DROP POLICY IF EXISTS vat_declarations_select ON public.vat_declarations;
DROP POLICY IF EXISTS vat_declarations_insert ON public.vat_declarations;
DROP POLICY IF EXISTS vat_declarations_update ON public.vat_declarations;
DROP POLICY IF EXISTS vat_declarations_delete ON public.vat_declarations;

-- Enable RLS (idempotent)
ALTER TABLE public.vat_declarations ENABLE ROW LEVEL SECURITY;

-- Create policies aligned with project standard (app_private.is_org_member)
CREATE POLICY vat_declarations_select
ON public.vat_declarations
FOR SELECT
USING (app_private.is_org_member(organization_id));

CREATE POLICY vat_declarations_insert
ON public.vat_declarations
FOR INSERT
WITH CHECK (app_private.is_org_member(organization_id));

CREATE POLICY vat_declarations_update
ON public.vat_declarations
FOR UPDATE
USING (app_private.is_org_member(organization_id))
WITH CHECK (app_private.is_org_member(organization_id));

-- Grants required for authenticated role to access the table through RLS
GRANT SELECT, INSERT, UPDATE ON public.vat_declarations TO authenticated;

-- Ensure the helper function is executable by authenticated
GRANT EXECUTE ON FUNCTION app_private.is_org_member(uuid) TO authenticated;
