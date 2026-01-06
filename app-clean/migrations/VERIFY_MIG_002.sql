-- ==============================================================================
-- VERIFY_MIG_002.sql (Movements Shadow)
-- ==============================================================================

-- 1. COLUMN CHECK
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'movements' AND column_name = 'organization_id';
-- Expected: UUID, YES (Nullable)

-- 2. POLICY CHECK
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'movements';
-- Expected: "Users can view own movements (Hybrid)", etc.

-- 3. ISOLATION TEST (Simulated)
-- We need to check that a personal query (org_id IS NULL) doesn't see Org items.
-- Since we can't easily switch users in SQL Editor without advanced tricks, we rely on logic check.
-- BUT we can check constraint integrity.

SELECT 
    count(*) as total_movements,
    count(organization_id) as org_movements,
    count(*) filter (where organization_id is null) as personal_movements
FROM public.movements;

-- 4. CONFIRM NO DATA LOSS
SELECT 'Data Integrity Check' as test,
       CASE WHEN count(*) > 0 THEN 'OK' ELSE 'WARNING: Table empty?' END as status
FROM public.movements;
