-- ==============================================================================
-- MIG_003: CATALOG ADAPTATION (SHADOW MODE)
-- ==============================================================================
-- Description: 
-- Applies the same "Hybrid RLS" pattern to:
-- 1. accounts
-- 2. categories
-- 3. recurring_rules
--
-- Safely adds 'organization_id' (Nullable) and updates Policies.
-- ==============================================================================

BEGIN;

-- 1. ACCOUNTS
-- ==============================================================================
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_accounts_organization_id ON public.accounts(organization_id);

-- RLS
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
CREATE POLICY "Users can view own accounts (Hybrid)" ON public.accounts FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = accounts.organization_id AND user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
CREATE POLICY "Users can insert own accounts (Hybrid)" ON public.accounts FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = accounts.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
CREATE POLICY "Users can update own accounts (Hybrid)" ON public.accounts FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = accounts.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can delete own accounts (Hybrid)" ON public.accounts FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = accounts.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);


-- 2. CATEGORIES
-- ==============================================================================
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_organization_id ON public.categories(organization_id);

-- RLS
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
CREATE POLICY "Users can view own categories (Hybrid)" ON public.categories FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = categories.organization_id AND user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories (Hybrid)" ON public.categories FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = categories.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories (Hybrid)" ON public.categories FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = categories.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories (Hybrid)" ON public.categories FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = categories.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);


-- 3. RECURRING RULES
-- ==============================================================================
ALTER TABLE public.recurring_rules
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_recurring_rules_organization_id ON public.recurring_rules(organization_id);

-- RLS
DROP POLICY IF EXISTS "Users can view own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can view own recurring rules (Hybrid)" ON public.recurring_rules FOR SELECT USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = recurring_rules.organization_id AND user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can insert own recurring rules (Hybrid)" ON public.recurring_rules FOR INSERT WITH CHECK (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = recurring_rules.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can update own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can update own recurring rules (Hybrid)" ON public.recurring_rules FOR UPDATE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = recurring_rules.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

DROP POLICY IF EXISTS "Users can delete own recurring rules" ON public.recurring_rules;
CREATE POLICY "Users can delete own recurring rules (Hybrid)" ON public.recurring_rules FOR DELETE USING (
  (organization_id IS NULL AND user_id = auth.uid()) OR
  (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = recurring_rules.organization_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')))
);

COMMIT;

NOTIFY pgrst, 'reload schema';
