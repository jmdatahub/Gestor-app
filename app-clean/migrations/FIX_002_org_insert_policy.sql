-- ============================================
-- FIX_002: Allow Direct Organization Creation
-- ============================================
-- Issue: MIG_001_v2 blocked direct INSERTs on organizations table
--        (was RPC-only design). Frontend uses direct INSERT.
-- Fix: Add INSERT policy for authenticated users.
-- ============================================

-- Add INSERT policy for organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

-- Also need INSERT policy for organization_members (to add creator as owner)
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.organization_members;
CREATE POLICY "Users can insert themselves as members"
ON public.organization_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- VERIFICATION
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Authenticated users can create organizations'
  ) THEN
    RAISE NOTICE '✅ INSERT policy for organizations created';
  ELSE
    RAISE WARNING '❌ INSERT policy NOT found';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organization_members' 
    AND policyname = 'Users can insert themselves as members'
  ) THEN
    RAISE NOTICE '✅ INSERT policy for organization_members created';
  ELSE
    RAISE WARNING '❌ INSERT policy for members NOT found';
  END IF;
END $$;
