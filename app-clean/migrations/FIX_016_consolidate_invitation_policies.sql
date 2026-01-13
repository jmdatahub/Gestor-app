-- ==============================================================================
-- FIX_016: Consolidate Invitation Policies
-- ==============================================================================
-- Purpose: Fix the bug where admins cannot cancel sent invitations.
--          Consolidates ALL permissions for 'organization_invitations' into
--          a single, clear set of rules.
-- ==============================================================================

-- 1. Reset: Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Users can decline their own invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Org members can view invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Org admins can delete invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Org admins can create invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "invitation_select_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "invitation_insert_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "invitation_delete_policy" ON public.organization_invitations;

-- Drop NEW policy names to allow re-running this script
DROP POLICY IF EXISTS "view_own_invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "view_org_invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "create_org_invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "cancel_org_invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "decline_own_invitations" ON public.organization_invitations;

-- 2. Enable RLS (just in case)
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- NEW POLICIES
-- ==============================================================================

-- A. SELECT (View)
-- 1. Users can see invitations sent TO them (by email) - Case insensitive
CREATE POLICY "view_own_invitations"
ON public.organization_invitations FOR SELECT
USING (
  lower(email) = (SELECT lower(email) FROM public.profiles WHERE id = auth.uid())
);

-- 2. Org Members (Admins/Owners/Members) can see sent invitations for their org
CREATE POLICY "view_org_invitations"
ON public.organization_invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = organization_invitations.org_id
    AND om.user_id = auth.uid()
  )
);

-- B. INSERT (Create)
-- Only Owners and Admins can create invitations
CREATE POLICY "create_org_invitations"
ON public.organization_invitations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = organization_invitations.org_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- C. DELETE (Cancel / Decline)
-- 1. Owners and Admins can CANCEL invitations sent by their org
CREATE POLICY "cancel_org_invitations"
ON public.organization_invitations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = organization_invitations.org_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- 2. Users can DECLINE invitations sent TO them - Case insensitive
CREATE POLICY "decline_own_invitations"
ON public.organization_invitations FOR DELETE
USING (
  lower(email) = (SELECT lower(email) FROM public.profiles WHERE id = auth.uid())
);

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ FIX_016: Policies for organization_invitations successfully consolidated.';
END $$;
