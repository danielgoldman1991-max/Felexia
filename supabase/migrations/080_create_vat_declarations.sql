-- Migration: create vat_declarations table
-- Purpose: Store VAT declaration drafts for internal preparatory use

CREATE TABLE IF NOT EXISTS public.vat_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  declaration_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  vat_regime text NOT NULL DEFAULT 'unspecified',
  status text NOT NULL DEFAULT 'draft',

  prior_credit numeric(14,2) NOT NULL DEFAULT 0,
  collected_vat numeric(14,2) NOT NULL DEFAULT 0,
  deductible_vat numeric(14,2) NOT NULL DEFAULT 0,
  vat_due numeric(14,2) NOT NULL DEFAULT 0,
  credit_to_carry_forward numeric(14,2) NOT NULL DEFAULT 0,

  taxable_turnover numeric(14,2) NOT NULL DEFAULT 0,
  total_sales_ttc numeric(14,2) NOT NULL DEFAULT 0,
  total_purchases_ht numeric(14,2) NOT NULL DEFAULT 0,
  total_purchases_ttc numeric(14,2) NOT NULL DEFAULT 0,

  customer_invoices_count integer NOT NULL DEFAULT 0,
  supplier_invoices_count integer NOT NULL DEFAULT 0,
  blocking_errors_count integer NOT NULL DEFAULT 0,
  warnings_count integer NOT NULL DEFAULT 0,

  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals_by_rate jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  submitted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- Constraints
ALTER TABLE public.vat_declarations
  DROP CONSTRAINT IF EXISTS vat_declarations_frequency_check,
  ADD CONSTRAINT vat_declarations_frequency_check CHECK (frequency IN ('monthly', 'quarterly', 'annual_control'));

ALTER TABLE public.vat_declarations
  DROP CONSTRAINT IF EXISTS vat_declarations_vat_regime_check,
  ADD CONSTRAINT vat_declarations_vat_regime_check CHECK (vat_regime IN ('encaissement', 'debit', 'mixed', 'unspecified'));

ALTER TABLE public.vat_declarations
  DROP CONSTRAINT IF EXISTS vat_declarations_status_check,
  ADD CONSTRAINT vat_declarations_status_check CHECK (status IN ('draft', 'under_review', 'validated', 'exported', 'archived'));

ALTER TABLE public.vat_declarations
  DROP CONSTRAINT IF EXISTS vat_declarations_period_check,
  ADD CONSTRAINT vat_declarations_period_check CHECK (period_start <= period_end);

-- Prevent duplicate non-archived declarations for same period/frequency/org
DROP INDEX IF EXISTS vat_declarations_unique_active_period;
CREATE UNIQUE INDEX vat_declarations_unique_active_period
  ON public.vat_declarations (organization_id, period_start, period_end, frequency)
  WHERE archived_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vat_declarations_org ON public.vat_declarations(organization_id);
CREATE INDEX IF NOT EXISTS idx_vat_declarations_period_start ON public.vat_declarations(period_start);
CREATE INDEX IF NOT EXISTS idx_vat_declarations_period_end ON public.vat_declarations(period_end);
CREATE INDEX IF NOT EXISTS idx_vat_declarations_status ON public.vat_declarations(status);
CREATE INDEX IF NOT EXISTS idx_vat_declarations_created_at ON public.vat_declarations(created_at);
CREATE INDEX IF NOT EXISTS idx_vat_declarations_archived_at ON public.vat_declarations(archived_at) WHERE archived_at IS NULL;

-- RLS
ALTER TABLE public.vat_declarations ENABLE ROW LEVEL SECURITY;

-- Policy: select for active members
DROP POLICY IF EXISTS vat_declarations_select ON public.vat_declarations;
CREATE POLICY vat_declarations_select ON public.vat_declarations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = vat_declarations.organization_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.status, 'active') = 'active'
    )
  );

-- Policy: insert for owner/admin/accountant
DROP POLICY IF EXISTS vat_declarations_insert ON public.vat_declarations;
CREATE POLICY vat_declarations_insert ON public.vat_declarations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.roles r ON r.id = m.role_id
      WHERE m.organization_id = vat_declarations.organization_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.status, 'active') = 'active'
        AND LOWER(COALESCE(r.name, '')) IN ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
    )
  );

-- Policy: update for owner/admin/accountant
DROP POLICY IF EXISTS vat_declarations_update ON public.vat_declarations;
CREATE POLICY vat_declarations_update ON public.vat_declarations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.roles r ON r.id = m.role_id
      WHERE m.organization_id = vat_declarations.organization_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.status, 'active') = 'active'
        AND LOWER(COALESCE(r.name, '')) IN ('owner', 'admin', 'administrateur', 'accountant', 'comptable')
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vat_declarations_updated_at ON public.vat_declarations;
CREATE TRIGGER vat_declarations_updated_at
  BEFORE UPDATE ON public.vat_declarations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
