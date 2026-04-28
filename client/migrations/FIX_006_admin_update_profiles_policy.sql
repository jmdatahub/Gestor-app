-- ============================================
-- FIX_006: Allow super admin to UPDATE profiles
-- ============================================
-- Purpose: Add RLS policy for super admins to update user profiles
-- (suspend/unsuspend functionality)
-- ============================================

-- Drop if exists to avoid errors
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;

-- Policy: Super admins can update any profile
CREATE POLICY "Super admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND p.is_super_admin = true
        )
    );

-- ============================================
-- VERIFICATION
-- ============================================
-- SELECT * FROM pg_policies WHERE tablename = 'profiles' AND policyname LIKE '%update%';
