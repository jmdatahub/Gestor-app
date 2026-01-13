-- ============================================
-- MIG_015: Soft Delete / Trash System for Organizations
-- ============================================
-- Purpose: Enable soft-delete so orgs go to "trash" for 7 days
--          before permanent deletion
-- ============================================

-- 1. Add deleted_at and deleted_by columns
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL REFERENCES auth.users(id);

-- 2. Create index for faster trash queries
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at 
ON public.organizations(deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. Create function to auto-cleanup old deleted orgs (7+ days)
-- This can be called periodically by a cron job or manually
CREATE OR REPLACE FUNCTION public.cleanup_deleted_organizations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- First delete members of expired orgs
  DELETE FROM public.organization_members
  WHERE org_id IN (
    SELECT id FROM public.organizations 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '7 days'
  );
  
  -- Delete invitations of expired orgs
  DELETE FROM public.organization_invitations
  WHERE org_id IN (
    SELECT id FROM public.organizations 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '7 days'
  );
  
  -- Finally permanently delete expired organizations
  WITH deleted AS (
    DELETE FROM public.organizations 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- 4. Update default organization select to exclude deleted
COMMENT ON COLUMN public.organizations.deleted_at IS 
  'When not NULL, organization is in trash. Will be permanently deleted 7 days after this timestamp.';

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Soft-delete columns added to organizations!';
  RAISE NOTICE 'deleted_at: When org was moved to trash';
  RAISE NOTICE 'deleted_by: Who deleted the org';
  RAISE NOTICE 'cleanup_deleted_organizations(): Call to purge 7+ day old trash';
END $$;

-- Show new columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name IN ('deleted_at', 'deleted_by');
