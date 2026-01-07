-- MIG_007_debts_shadow.sql
-- Add organization_id to DEBTS and DEBT_MOVEMENTS tables
-- Enable Hybrid RLS for full workspace isolation

-- 1. ADAPT DEBTS TABLE
-- ==============================================================================
ALTER TABLE public.debts
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_debts_organization_id ON public.debts(organization_id);

-- Update RLS Policies for debts
DROP POLICY IF EXISTS "Users can manage own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;

CREATE POLICY "Users can view own debts (Hybrid)" ON public.debts FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid()))
);

CREATE POLICY "Users can insert debts (Hybrid)" ON public.debts FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = organization_id AND user_id = auth.uid()))
);

CREATE POLICY "Users can update own debts (Hybrid)" ON public.debts FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

CREATE POLICY "Users can delete own debts (Hybrid)" ON public.debts FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin')))
);

-- 2. ADAPT DEBT_MOVEMENTS TABLE (Inherits from debts usually, but let's be safe)
-- Debt movements are linked to a debt, which is linked to an org.
-- RLS on debt_movements normally checks the parent debt.
-- Let's check if debt_movements needs direct RLS update or if it relies on debt ownership.
-- Usually, we check: debt_id -> debt.user_id = auth.uid().
-- We need to update this logic to: debt_id -> debt.organization_id check.

DROP POLICY IF EXISTS "Users can manage own debt movements" ON public.debt_movements;
DROP POLICY IF EXISTS "Users can view own debt movements" ON public.debt_movements;
DROP POLICY IF EXISTS "Users can insert own debt movements" ON public.debt_movements;

CREATE POLICY "Users can view debt movements (Hybrid)" ON public.debt_movements FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.debts 
    WHERE id = debt_movements.debt_id 
    AND (
      (organization_id IS NULL AND user_id = auth.uid()) OR
      (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid()))
    )
  )
);

CREATE POLICY "Users can insert debt movements (Hybrid)" ON public.debt_movements FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.debts 
    WHERE id = debt_movements.debt_id 
    AND (
      (organization_id IS NULL AND user_id = auth.uid()) OR
      (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid()))
    )
  )
);

CREATE POLICY "Users can update debt movements (Hybrid)" ON public.debt_movements FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.debts 
    WHERE id = debt_movements.debt_id 
    AND (
      (organization_id IS NULL AND user_id = auth.uid()) OR
      (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid()))
    )
  )
);

CREATE POLICY "Users can delete debt movements (Hybrid)" ON public.debt_movements FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.debts 
    WHERE id = debt_movements.debt_id 
    AND (
      (organization_id IS NULL AND user_id = auth.uid()) OR
      (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid()))
    )
  )
);
