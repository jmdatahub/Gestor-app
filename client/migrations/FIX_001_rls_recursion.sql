-- ==============================================================================
-- FIX_001: RLS RECURSION FIX
-- ==============================================================================
-- Description: Fixes the infinite recursion error in 'organization_members' RLS.
--              Introduces a helper function to fetch user's organizations safely.
-- ==============================================================================

BEGIN;

-- 1. Helper Function (Bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_my_org_ids() 
RETURNS UUID[] 
LANGUAGE sql 
STABLE SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT array_agg(org_id) FROM public.organization_members WHERE user_id = auth.uid();
$$;

-- 2. Update Policy for 'organization_members'
DROP POLICY IF EXISTS "Members see other members" ON public.organization_members;

CREATE POLICY "Members see other members" 
ON public.organization_members FOR SELECT 
USING (
  org_id = ANY(public.get_my_org_ids())
);

COMMIT;

-- VERIFICATION
-- This query acts as a test. If it fails with recursion, the fix failed.
-- SELECT * FROM public.organization_members WHERE user_id = auth.uid();
