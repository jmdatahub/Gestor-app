-- ============================================
-- MIG_010: Allow reading organization member profiles
-- ============================================
-- Purpose: Add RLS policy to allow organization members
--          to see each other's profiles
-- ============================================

-- Policy: Members can view profiles of other members in their organizations
CREATE POLICY "Organization members can view coworker profiles"
    ON public.profiles FOR SELECT
    USING (
        -- Allow if the viewer and the profile owner share at least one organization
        EXISTS (
            SELECT 1 
            FROM public.organization_members viewer_orgs
            INNER JOIN public.organization_members profile_owner_orgs 
                ON viewer_orgs.org_id = profile_owner_orgs.org_id
            WHERE viewer_orgs.user_id = auth.uid()
              AND profile_owner_orgs.user_id = profiles.id
        )
    );

-- ============================================
-- VERIFICATION
-- ============================================
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';
