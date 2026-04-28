-- ============================================
-- FIX_004: Allow Invitation Management
-- ============================================
-- Issue: Need SELECT and DELETE policies for organization_invitations
-- ============================================

-- Allow org members to view invitations
DROP POLICY IF EXISTS "Org members can view invitations" ON public.organization_invitations;
CREATE POLICY "Org members can view invitations"
ON public.organization_invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = organization_invitations.org_id 
    AND om.user_id = auth.uid()
  )
);

-- Allow org admins/owners to delete invitations
DROP POLICY IF EXISTS "Org admins can delete invitations" ON public.organization_invitations;
CREATE POLICY "Org admins can delete invitations"
ON public.organization_invitations FOR DELETE
USING (
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
  RAISE NOTICE '✅ Invitation management policies created';
END $$;
