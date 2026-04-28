-- ============================================
-- FIX_003: Allow Organization Invitations Insert
-- ============================================
-- Issue: The organization_invitations table needs INSERT policy
--        for org owners/admins to send invitations
-- ============================================

-- Allow org admins/owners to create invitations
DROP POLICY IF EXISTS "Org admins can create invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can create invitations"
ON public.organization_invitations FOR INSERT
WITH CHECK (
  -- The user creating the invitation must be owner or admin of the org
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = organization_invitations.org_id 
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- VERIFICATION
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organization_invitations' 
    AND policyname = 'Org admins can create invitations'
  ) THEN
    RAISE NOTICE '✅ INSERT policy for organization_invitations created';
  ELSE
    RAISE WARNING '❌ INSERT policy NOT found';
  END IF;
END $$;
