-- ============================================
-- MIGRATION 008: Organization Hierarchy & Description
-- ============================================
-- Adds:
--   1. parent_id (UUID, FK to organizations) - for conglomerate/hierarchy
--   2. description (TEXT) - organization description
-- ============================================

-- 1. Add parent_id column (self-referencing FK)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 2. Add description column
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Create index for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON public.organizations(parent_id);

-- 4. Add comment for documentation
COMMENT ON COLUMN public.organizations.parent_id IS 'Reference to parent organization (conglomerate structure)';
COMMENT ON COLUMN public.organizations.description IS 'Organization description or summary';

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  -- Check parent_id column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'parent_id'
  ) THEN
    RAISE NOTICE '✅ parent_id column exists in organizations';
  ELSE
    RAISE WARNING '❌ parent_id column NOT found in organizations';
  END IF;
  
  -- Check description column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'description'
  ) THEN
    RAISE NOTICE '✅ description column exists in organizations';
  ELSE
    RAISE WARNING '❌ description column NOT found in organizations';
  END IF;
  
  -- Check index
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND indexname = 'idx_organizations_parent_id'
  ) THEN
    RAISE NOTICE '✅ parent_id index exists';
  ELSE
    RAISE WARNING '❌ parent_id index NOT found';
  END IF;
END $$;
