-- ============================================
-- MIG_013: Super Admin Full Access Policy
-- ============================================
-- Purpose: Allow super admins to view all organizations,
--          profiles, and org members for admin panel
-- ============================================

-- 1. Allow super admins to view ALL organizations
DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
CREATE POLICY "Super admins can view all organizations"
ON public.organizations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
  )
);

-- 2. Allow super admins to view ALL profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_super_admin = true
  )
);

-- 3. Allow super admins to UPDATE profiles (suspend/unsuspend)
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;
CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_super_admin = true
  )
);

-- 4. Allow super admins to view ALL organization members
DROP POLICY IF EXISTS "Super admins can view all org members" ON public.organization_members;
CREATE POLICY "Super admins can view all org members"
ON public.organization_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
  )
);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Super admin policies created!';
  RAISE NOTICE 'Super admins can now view/manage all organizations, profiles, and members.';
END $$;

-- Quick test: Check if policies exist
SELECT policyname, tablename FROM pg_policies 
WHERE schemaname = 'public' 
AND policyname LIKE '%Super admin%'
ORDER BY tablename;
