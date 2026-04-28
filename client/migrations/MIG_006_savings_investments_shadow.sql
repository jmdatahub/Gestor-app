-- ==============================================================================
-- MIG_006: SAVINGS & INVESTMENTS ADAPTATION (SHADOW MODE)
-- ==============================================================================
-- Description: 
-- Applies the same "Hybrid RLS" pattern to:
-- 1. savings_goals
-- 2. savings_contributions 
-- 3. investments
-- 4. investment_price_history
--
-- Safely adds 'organization_id' (Nullable) and updates Policies.
-- ==============================================================================

BEGIN;

-- 1. SAVINGS GOALS
-- ==============================================================================
ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_savings_goals_organization_id ON public.savings_goals(organization_id);

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;

CREATE POLICY "Users can view own savings goals (Hybrid)" ON public.savings_goals FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid()))
);

CREATE POLICY "Users can insert own savings goals (Hybrid)" ON public.savings_goals FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

CREATE POLICY "Users can update own savings goals (Hybrid)" ON public.savings_goals FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

CREATE POLICY "Users can delete own savings goals (Hybrid)" ON public.savings_goals FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);


-- 2. INVESTMENTS
-- ==============================================================================
ALTER TABLE public.investments 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_investments_organization_id ON public.investments(organization_id);

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;

CREATE POLICY "Users can view own investments (Hybrid)" ON public.investments FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid()))
);

CREATE POLICY "Users can insert own investments (Hybrid)" ON public.investments FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

CREATE POLICY "Users can update own investments (Hybrid)" ON public.investments FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

CREATE POLICY "Users can delete own investments (Hybrid)" ON public.investments FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);


-- 3. INVESTMENT PRICE HISTORY (follows parent investment)
-- ==============================================================================
-- Note: Price history inherits access from parent investment, so simpler policy
DROP POLICY IF EXISTS "Users can manage investment price history" ON public.investment_price_history;
DROP POLICY IF EXISTS "Users can view investment price history" ON public.investment_price_history;

CREATE POLICY "Users can view investment price history" ON public.investment_price_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.investments WHERE id = investment_price_history.investment_id AND (
    (organization_id IS NULL AND investments.user_id = auth.uid()) OR
    (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid()))
  ))
);

CREATE POLICY "Users can insert investment price history" ON public.investment_price_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.investments WHERE id = investment_price_history.investment_id AND (
    (organization_id IS NULL AND investments.user_id = auth.uid()) OR
    (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid()))
  ))
);

CREATE POLICY "Users can delete investment price history" ON public.investment_price_history FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.investments WHERE id = investment_price_history.investment_id AND (
    (organization_id IS NULL AND investments.user_id = auth.uid()) OR
    (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid()))
  ))
);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================
-- Run these to verify:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'savings_goals' AND column_name = 'organization_id';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'investments' AND column_name = 'organization_id';
-- SELECT * FROM pg_policies WHERE tablename IN ('savings_goals', 'investments');
