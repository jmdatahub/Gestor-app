-- ============================================
-- MIG_014: Super Admin Full Organization Control
-- ============================================
-- Purpose: Allow super admins to UPDATE and DELETE any organization
-- ============================================

-- 1. Allow super admins to UPDATE any organization
DROP POLICY IF EXISTS "Super admins can update all organizations" ON public.organizations;
CREATE POLICY "Super admins can update all organizations"
ON public.organizations FOR UPDATE
USING (
  public.is_super_admin() = true
);

-- 2. Allow super admins to DELETE any organization
DROP POLICY IF EXISTS "Super admins can delete all organizations" ON public.organizations;
CREATE POLICY "Super admins can delete all organizations"
ON public.organizations FOR DELETE
USING (
  public.is_super_admin() = true
);

-- 3. Allow super admins to DELETE any organization member
DROP POLICY IF EXISTS "Super admins can delete all org members" ON public.organization_members;
CREATE POLICY "Super admins can delete all org members"
ON public.organization_members FOR DELETE
USING (
  public.is_super_admin() = true
);

-- 4. Allow super admins to UPDATE any organization member
DROP POLICY IF EXISTS "Super admins can update all org members" ON public.organization_members;
CREATE POLICY "Super admins can update all org members"
ON public.organization_members FOR UPDATE
USING (
  public.is_super_admin() = true
);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Super admin UPDATE/DELETE policies created!';
END $$;

SELECT policyname, tablename, cmd FROM pg_policies 
WHERE schemaname = 'public' 
AND policyname LIKE '%Super admin%'
ORDER BY tablename, cmd;
