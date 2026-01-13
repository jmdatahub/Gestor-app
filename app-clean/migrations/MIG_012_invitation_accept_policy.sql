-- ============================================
-- MIG_012: Allow users to see their own invitations by email
-- ============================================
-- Purpose: Users need to see invitations sent to their email
--          so they can accept or decline them
-- ============================================

-- Allow users to SELECT invitations where the email matches their own
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.organization_invitations;
CREATE POLICY "Users can view their own invitations"
ON public.organization_invitations FOR SELECT
USING (
  -- Match invitation email with the user's email from profiles
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.email = organization_invitations.email
  )
);

-- Allow users to DELETE invitations sent to them (decline)
DROP POLICY IF EXISTS "Users can decline their own invitations" ON public.organization_invitations;
CREATE POLICY "Users can decline their own invitations"
ON public.organization_invitations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.email = organization_invitations.email
  )
);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organization_invitations' 
    AND policyname = 'Users can view their own invitations'
  ) THEN
    RAISE NOTICE '✅ SELECT policy for user invitations created';
  ELSE
    RAISE WARNING '❌ SELECT policy NOT found';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organization_invitations' 
    AND policyname = 'Users can decline their own invitations'
  ) THEN
    RAISE NOTICE '✅ DELETE policy for user invitations created';
  ELSE
    RAISE WARNING '❌ DELETE policy NOT found';
  END IF;
END $$;

-- Show all policies for verification
-- SELECT * FROM pg_policies WHERE tablename = 'organization_invitations';
