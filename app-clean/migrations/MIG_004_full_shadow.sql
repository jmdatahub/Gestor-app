-- ==============================================================================
-- MIG_004: FULL SHADOW ADAPTATION (COMPLETE ISOLATION)
-- ==============================================================================
-- Description: 
-- Extends the "Hybrid RLS" pattern to ALL remaining user-centric tables.
-- This ensures that Savings Goals, Investments, and Debts are also isolated per workspace.
--
-- Tables affected:
-- 1. savings_goals
-- 2. savings_goal_contributions
-- 3. investments
-- 4. investment_price_history
-- 5. debts
--
-- ==============================================================================

BEGIN;

-- 1. SAVINGS GOALS
-- ==============================================================================
ALTER TABLE public.savings_goals 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_savings_goals_organization_id ON public.savings_goals(organization_id);

-- RLS
DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
CREATE POLICY "Users can view own savings goals (Hybrid)" ON public.savings_goals FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
CREATE POLICY "Users can insert own savings goals (Hybrid)" ON public.savings_goals FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
CREATE POLICY "Users can update own savings goals (Hybrid)" ON public.savings_goals FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;
CREATE POLICY "Users can delete own savings goals (Hybrid)" ON public.savings_goals FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goals.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);


-- 2. SAVINGS GOAL CONTRIBUTIONS (Inherits context via Logic, but safer to add column for direct RLS)
-- Note: Usually contributions belong to a goal, which belongs to an org. 
-- However, for strict RLS performance and simplicity, adding organization_id here is safer than a join in RLS.
-- ==============================================================================
ALTER TABLE public.savings_goal_contributions
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_savings_contributions_organization_id ON public.savings_goal_contributions(organization_id);

-- RLS
DROP POLICY IF EXISTS "Users can view own contributions" ON public.savings_goal_contributions;
CREATE POLICY "Users can view own contributions (Hybrid)" ON public.savings_goal_contributions FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goal_contributions.organization_id AND user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own contributions" ON public.savings_goal_contributions;
CREATE POLICY "Users can insert own contributions (Hybrid)" ON public.savings_goal_contributions FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goal_contributions.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can update own contributions" ON public.savings_goal_contributions;
CREATE POLICY "Users can update own contributions (Hybrid)" ON public.savings_goal_contributions FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goal_contributions.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can delete own contributions" ON public.savings_goal_contributions;
CREATE POLICY "Users can delete own contributions (Hybrid)" ON public.savings_goal_contributions FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = savings_goal_contributions.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);


-- 3. INVESTMENTS
-- ==============================================================================
ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_investments_organization_id ON public.investments(organization_id);

-- RLS
DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
CREATE POLICY "Users can view own investments (Hybrid)" ON public.investments FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
CREATE POLICY "Users can insert own investments (Hybrid)" ON public.investments FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
CREATE POLICY "Users can update own investments (Hybrid)" ON public.investments FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;
CREATE POLICY "Users can delete own investments (Hybrid)" ON public.investments FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investments.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);


-- 4. INVESTMENT PRICE HISTORY
-- ==============================================================================
-- Usually linked to investment_id, but again, standardizing with org_id for easier RLS
ALTER TABLE public.investment_price_history
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- RLS
DROP POLICY IF EXISTS "Users can view own price history" ON public.investment_price_history;
CREATE POLICY "Users can view own price history (Hybrid)" ON public.investment_price_history FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investment_price_history.organization_id AND user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own price history" ON public.investment_price_history;
CREATE POLICY "Users can insert own price history (Hybrid)" ON public.investment_price_history FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = investment_price_history.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

-- Note: History usually isn't updated, just inserted. But adding update/delete for consistency if needed.


-- 5. DEBTS
-- ==============================================================================
-- Assuming 'debts' table exists (based on code inspection/summaryService). 
-- If it doesn't exist in MIG files, it might be in base schema. 
-- If it fails, the transaction will rollback.

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'debts') THEN
        ALTER TABLE public.debts
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS idx_debts_organization_id ON public.debts(organization_id);

        -- RLS (Dynamic SQL to avoid compilation errors if table missing)
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own debts" ON public.debts';
        EXECUTE 'CREATE POLICY "Users can view own debts (Hybrid)" ON public.debts FOR SELECT USING (
          (organization_id IS NULL AND user_id = auth.uid()) OR
          (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid()))
        )';
        
        EXECUTE 'DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts';
        EXECUTE 'CREATE POLICY "Users can insert own debts (Hybrid)" ON public.debts FOR INSERT WITH CHECK (
          (organization_id IS NULL AND user_id = auth.uid()) OR
          (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid() AND role IN (''owner'', ''admin'', ''member'')))
        )';

        EXECUTE 'DROP POLICY IF EXISTS "Users can update own debts" ON public.debts';
        EXECUTE 'CREATE POLICY "Users can update own debts (Hybrid)" ON public.debts FOR UPDATE USING (
          (organization_id IS NULL AND user_id = auth.uid()) OR
          (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid() AND role IN (''owner'', ''admin'', ''member'')))
        )';
        
        EXECUTE 'DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts';
        EXECUTE 'CREATE POLICY "Users can delete own debts (Hybrid)" ON public.debts FOR DELETE USING (
          (organization_id IS NULL AND user_id = auth.uid()) OR
          (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = debts.organization_id AND user_id = auth.uid() AND role IN (''owner'', ''admin'', ''member'')))
        )';
    END IF;
END $$;


COMMIT;

NOTIFY pgrst, 'reload schema';
