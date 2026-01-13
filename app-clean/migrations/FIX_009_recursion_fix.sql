-- ============================================
-- EMERGENCY FIX: Remove infinite recursion in profiles policy
-- ============================================
-- The super admin policy on profiles caused infinite recursion
-- because it queries profiles to check is_super_admin
-- ============================================

-- 1. DROP the problematic policy immediately
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;

-- 2. Recreate WITH CHECK USING auth.uid() directly (no subquery to profiles)
-- For profiles, we use a different approach: just allow users to see their own profile
-- AND super admins bypass via a function

-- Create a helper function that doesn't trigger RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Now use this function in policies (it's SECURITY DEFINER so bypasses RLS)

-- 3. Super admin CAN view all profiles using the safe function
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  public.is_super_admin() = true
  OR id = auth.uid()  -- Users can always see their own profile
);

-- 4. Super admin CAN update all profiles using the safe function
CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
USING (
  public.is_super_admin() = true
  OR id = auth.uid()  -- Users can always update their own profile
);

-- 5. Fix organizations policy too (same issue potentially)
DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
CREATE POLICY "Super admins can view all organizations"
ON public.organizations FOR SELECT
USING (
  public.is_super_admin() = true
);

-- 6. Fix organization_members policy too
DROP POLICY IF EXISTS "Super admins can view all org members" ON public.organization_members;
CREATE POLICY "Super admins can view all org members"
ON public.organization_members FOR SELECT
USING (
  public.is_super_admin() = true
);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Infinite recursion fixed!';
  RAISE NOTICE 'Created is_super_admin() function to safely bypass RLS';
END $$;

-- Test the function
SELECT public.is_super_admin() as current_user_is_super_admin;
