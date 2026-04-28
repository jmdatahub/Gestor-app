-- ============================================
-- FIX_005: Allow Organization Delete by Owners
-- ============================================
-- Issue: Owners need to be able to delete their organizations
-- ============================================

-- Allow owners to delete their organizations
DROP POLICY IF EXISTS "Owners can delete organizations" ON public.organizations;
CREATE POLICY "Owners can delete organizations"
ON public.organizations FOR DELETE
USING (auth.uid() = owner_id);

-- VERIFICATION
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Owners can delete organizations'
  ) THEN
    RAISE NOTICE '✅ DELETE policy for organizations created';
  ELSE
    RAISE WARNING '❌ DELETE policy NOT found';
  END IF;
END $$;
