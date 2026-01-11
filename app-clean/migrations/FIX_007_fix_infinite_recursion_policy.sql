-- ============================================
-- FIX_007: Fix infinite recursion in profiles RLS
-- ============================================
-- Purpose: Fix the infinite recursion error in profiles policies
-- by using auth.jwt() instead of querying profiles table
-- ============================================

-- Drop all problematic policies first
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles" ON public.profiles;

-- Create a security definer function to check super admin
-- This bypasses RLS and prevents infinite recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

-- Policy: Super admins can update any profile (using security definer function)
CREATE POLICY "Super admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (
        public.is_super_admin()
    );

-- Policy: Super admins can delete any profile (using security definer function)
CREATE POLICY "Super admins can delete profiles"
    ON public.profiles FOR DELETE
    USING (
        public.is_super_admin()
    );

-- ============================================
-- VERIFICATION
-- ============================================
-- SELECT public.is_super_admin();
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';
