-- ============================================
-- MIG_011: Allow super admin to delete profiles
-- ============================================
-- Purpose: Add RLS policy for super admins to delete user profiles
-- ============================================

-- Policy: Super admins can delete any profile
CREATE POLICY "Super admins can delete profiles"
    ON public.profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND p.is_super_admin = true
        )
    );

-- Policy: Super admins can delete organization members
CREATE POLICY "Super admins can delete org members"
    ON public.organization_members FOR DELETE
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
-- SELECT * FROM pg_policies WHERE tablename IN ('profiles', 'organization_members');
