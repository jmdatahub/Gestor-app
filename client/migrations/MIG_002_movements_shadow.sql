-- ==============================================================================
-- MIG_002: MOVEMENTS SHADOW ADAPTATION (HYBRID RLS)
-- ==============================================================================
-- Description: 
-- 1. Adds 'organization_id' (Nullable) to 'movements'.
-- 2. Updates RLS to support BOTH Personal (org_id is null) AND Org (org_id = X).
-- 3. Ensures no locking or downtime for current personal users.
-- ==============================================================================

BEGIN;

-- 1. ADD COLUMN (SHADOW MODE)
-- ==============================================================================
-- IF NOT EXISTS guarantees idempotency
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_movements_organization_id ON public.movements(organization_id);


-- 2. UPDATE RLS POLICIES (HYBRID LOGIC)
-- ==============================================================================
-- We must DROP existing policies first to replace them with the new hybrid ones.

-- A) VIEW (SELECT)
DROP POLICY IF EXISTS "Users can view own movements" ON public.movements;
CREATE POLICY "Users can view own movements (Hybrid)" 
ON public.movements FOR SELECT 
USING (
  -- CASE 1: Personal Workspace (Legacy/Default)
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- CASE 2: Organization Workspace
  (
    organization_id IS NOT NULL 
    AND 
    EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE org_id = movements.organization_id 
      AND user_id = auth.uid()
    )
  )
);

-- B) INSERT
DROP POLICY IF EXISTS "Users can insert own movements" ON public.movements;
CREATE POLICY "Users can insert own movements (Hybrid)" 
ON public.movements FOR INSERT 
WITH CHECK (
  -- CASE 1: Personal
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- CASE 2: Organization (Must be member, not viewer ideally, but starter simple)
  (
    organization_id IS NOT NULL 
    AND 
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = movements.organization_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member') -- Viewers cannot insert
    )
  )
);

-- C) UPDATE
DROP POLICY IF EXISTS "Users can update own movements" ON public.movements;
CREATE POLICY "Users can update own movements (Hybrid)" 
ON public.movements FOR UPDATE 
USING (
  -- CASE 1: Personal
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- CASE 2: Organization
  (
    organization_id IS NOT NULL 
    AND 
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = movements.organization_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  )
);

-- D) DELETE
DROP POLICY IF EXISTS "Users can delete own movements" ON public.movements;
CREATE POLICY "Users can delete own movements (Hybrid)" 
ON public.movements FOR DELETE 
USING (
  -- CASE 1: Personal
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- CASE 2: Organization
  (
    organization_id IS NOT NULL 
    AND 
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = movements.organization_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  )
);

COMMIT;

-- REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';
